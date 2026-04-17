#!/usr/bin/env bash
# cmok · post-build healthcheck
# Sprawdza systematycznie czy push + SOS działają end-to-end na prod.
#
# Wymaga:
#   - export RESET_SECRET="<secret z 1Password>"
#   - zainstalowany psql LUB jq + curl
#
# Użycie:
#   bash scripts/healthcheck-build.sh

set -euo pipefail

PROJECT="pckpxspcecbvjprxmdja"
SUPA_URL="https://${PROJECT}.supabase.co"

if [[ -z "${RESET_SECRET:-}" ]]; then
  echo "❌ Brak RESET_SECRET. export RESET_SECRET='...' i spróbuj ponownie."
  exit 1
fi

# Anon JWT publishable key (ze starego anon, nie service role)
# Pobierz z: supabase secrets list, lub dashboard Settings → API
if [[ -z "${SUPA_ANON_KEY:-}" ]]; then
  echo "❌ Brak SUPA_ANON_KEY. export SUPA_ANON_KEY='eyJ...'"
  exit 1
fi

echo "════════════════════════════════════════════════════════════"
echo "  cmok healthcheck — $(date '+%Y-%m-%d %H:%M:%S')"
echo "════════════════════════════════════════════════════════════"

# 1. Sprawdź że wszystkie 12 edge functions odpowiadają OPTIONS
echo
echo "▶ 1. Edge functions (OPTIONS):"
for fn in checkin-notify nudge-signal register-device delete-account urgent-signal \
          morning-reminder missed-sign-alert weekly-summary checkin-monitor \
          reaction-notify poke-notify reset-test-data; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "${SUPA_URL}/functions/v1/${fn}")
  if [[ "$code" == "200" || "$code" == "204" ]]; then
    printf "   ✓ %-22s %s\n" "$fn" "$code"
  else
    printf "   ✗ %-22s %s\n" "$fn" "$code"
  fi
done

# 2. Sprawdź push tokens dla testowych userów
echo
echo "▶ 2. Push tokens w device_installations:"
SQL="SELECT u.phone, u.name, di.platform, di.app_version,
            CASE WHEN di.push_token IS NULL THEN 'NULL' ELSE 'OK ('||substring(di.push_token, 1, 20)||')' END AS token,
            di.notifications_enabled,
            EXTRACT(EPOCH FROM (now() - di.last_seen_at))::int AS seconds_ago
     FROM users u LEFT JOIN device_installations di ON di.user_id = u.id
     WHERE u.phone IN ('48100000001','48100000002','48100000003')
     ORDER BY u.phone;"

curl -s -X POST "${SUPA_URL}/rest/v1/rpc/exec_sql" \
  -H "apikey: ${SUPA_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPA_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"${SQL}\"}" 2>/dev/null \
  || echo "   (uwaga: exec_sql RPC nie istnieje — sprawdź ręcznie w Supabase SQL editor)"

# 3. Reset bazy do clean state (nie usuwa kont)
echo
echo "▶ 3. Reset test data → clean state (keep_pair):"
curl -s -X POST "${SUPA_URL}/functions/v1/reset-test-data" \
  -H "Content-Type: application/json" \
  -H "x-reset-secret: ${RESET_SECRET}" \
  -d '{"mode":"keep_pair"}' | head -c 300
echo

# 4. Sprawdź że urgent-signal NIE puszcza bez auth
echo
echo "▶ 4. urgent-signal bez auth (musi być 401):"
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${SUPA_URL}/functions/v1/urgent-signal" \
  -H "Content-Type: application/json" -d '{}')
[[ "$code" == "401" ]] && echo "   ✓ 401 (correct — wymaga JWT)" || echo "   ✗ ${code} (oczekiwane 401)"

# 5. Sprawdź że reset-test-data NIE puszcza bez sekretu
echo
echo "▶ 5. reset-test-data bez sekretu (musi być 401):"
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${SUPA_URL}/functions/v1/reset-test-data" \
  -H "Content-Type: application/json" -d '{"mode":"keep_pair"}')
[[ "$code" == "401" ]] && echo "   ✓ 401 (correct — wymaga sekretu)" || echo "   ✗ ${code} (oczekiwane 401)"

echo
echo "════════════════════════════════════════════════════════════"
echo "  Następny krok: ZALOGUJ SIĘ NA TELEFONIE Mamą i zrób:"
echo "  1. SELECT push_token FROM device_installations WHERE ..."
echo "  2. Daj znak → drugi telefon dostaje push?"
echo "  3. Potrzebuję pomocy → SOS → drugi telefon dostaje push?"
echo "════════════════════════════════════════════════════════════"
