#!/usr/bin/env bash

set -euo pipefail

MODE="${1:-keep_pair}"
PROJECT_REF="${SUPABASE_PROJECT_REF:-pckpxspcecbvjprxmdja}"

if [[ -z "${RESET_TEST_SECRET:-}" ]]; then
  echo "Brak RESET_TEST_SECRET. Pobierz secret z Supabase Functions -> reset-test-data -> Secrets." >&2
  exit 1
fi

case "$MODE" in
  keep_pair|full_reset|seed_invite|seed_sasiad|seed_apple_review) ;;
  *)
    echo "Nieznany tryb resetu: $MODE" >&2
    exit 1
    ;;
esac

curl -fsS -X POST "https://${PROJECT_REF}.supabase.co/functions/v1/reset-test-data" \
  -H "Content-Type: application/json" \
  -H "x-reset-secret: ${RESET_TEST_SECRET}" \
  -d "{\"mode\":\"${MODE}\"}"
