# Codex Prompt — Push + SOS End-to-End Audit

## Kontekst dla AI

Jesteś niezależnym audytorem. Ja jestem dev cmok (React Native + Expo + Supabase, polski rynek senior care). Build 18 właśnie wszedł do TestFlight z naprawami RODO, ale produkcja od kilku dni ma DWA powtarzające się bugi które kolejne buildy NIE naprawiają. Twoje zadanie: znaleźć root cause z TWARDYMI dowodami z kodu + live bazy, i powiedzieć czy te bugi są naprawione w Build 18 czy nie.

**Nie ufaj mojemu raportowi.** Sam czytaj kod i odpalaj zapytania na żywo (masz Supabase MCP). Jak coś nie zgadza się ze mną — powiedz to wprost.

## Bug A — SOS przerzuca do onboardingu zamiast wysłać sygnał

**Symptom (od usera):** Mama klika "Potrzebuję pomocy", potwierdza, ekran znika i ląduje w onboardingu. Żaden alert nie wpada do bazy. Powtarzalne na fizycznym telefonie po dłuższej sesji.

**Hipoteza ode mnie (zweryfikuj):** `urgent-signal` ma `verify_jwt: true`. Klient cache'uje JWT lokalnie. Gdy konto na backendzie zostaje skasowane (przez `delete-account` lub `reset-test-data full_reset`), JWT cached zostaje, ale Supabase Edge Runtime odrzuca z 401 ("403: User from sub claim in JWT does not exist"). Klient łapie 401, robi `signOut()`, redirect na `/onboarding`.

**Plików do przeczytania:**
- `src/hooks/useUrgentSignal.ts` (lines 226-249 — callEdgeFunction)
- `src/screens/SignalerHomeScreen.tsx` (handler SOS, NO_AUTH path)
- `app/_layout.tsx` (auth state listener)

**Live checks:**
1. `supabase logs --service edge-function | grep urgent-signal` w ostatnich 24h — ile 401, ile 200?
2. `SELECT * FROM auth.audit_log_entries WHERE payload->>'msg' LIKE '%User from sub claim%' ORDER BY created_at DESC LIMIT 20;`
3. Czy `useUrgentSignal.preflight()` jest wywoływane PRZED kliknięciem SOS i czy wyłapie dead session zanim user dotknie czerwonego buttona?

**Verdict criteria:**
- ✅ Naprawione: gdy session jest dead, user widzi "Sesja wygasła, zaloguj się ponownie" PRZED kliknięciem SOS, nie po.
- ❌ Nie naprawione: user widzi działający home screen, klika SOS, dopiero wtedy redirect.

## Bug B — Push notifications nie chodzą

**Symptom (od usera):** "ja jako recipient wysłałem kocham mama nie dostała push" (powtórzone wielokrotnie przez ostatnie buildy 13-17).

**Hipoteza ode mnie (zweryfikuj):** Tabela `device_installations` ma TYLKO 2 wpisy w prod (Mama test + jedno real konto). Brak Darka testowego. Push fizycznie nie ma do kogo iść. Przyczyna: `register-device` zwraca 500 w ~25% wywołań (4/15 ostatnich), albo klient nie wywołuje go w ogóle dla niektórych userów.

**Plików do przeczytania:**
- `src/services/notifications.ts` (registerPushToken — kiedy się wywołuje, jak obsługuje błędy)
- `app/_layout.tsx` (registerPushToken w useEffect, listener auth)
- `supabase/functions/register-device/index.ts` (czemu zwraca 500)
- `supabase/functions/checkin-notify/index.ts` + `reaction-notify` + `poke-notify` (czy faktycznie wysyłają do Expo Push API i parsują response)

**Live checks:**
1. `SELECT u.phone, u.name, di.push_token IS NOT NULL AS has_token, di.notifications_enabled, di.last_seen_at FROM users u LEFT JOIN device_installations di ON di.user_id = u.id ORDER BY di.last_seen_at DESC NULLS LAST LIMIT 30;`
2. `SELECT * FROM supabase_logs(...) WHERE function='register-device' AND status_code=500;` — co konkretnie pada?
3. Czy `checkin-notify` faktycznie woła `https://exp.host/--/api/v2/push/send` i co dostaje w response? Czy są retry?
4. Wgraj w bash `curl -X POST https://exp.host/--/api/v2/push/send -H 'Content-Type: application/json' -d '{"to":"<token z bazy>","title":"test","body":"test"}'` — co Expo zwraca?

**Verdict criteria:**
- ✅ Naprawione: 100% loginów rejestruje push token (po grant permissions) + przykładowy push dochodzi w <10s.
- ❌ Nie naprawione: jakikolwiek scenariusz w którym token jest NULL po loginie + grant, albo Expo zwraca DeviceNotRegistered, albo response 200 ale push nie dochodzi.

## Co konkretnie sprawdź w Build 18

`git log b92bac4..HEAD --oneline` w repo `/Users/darekptaszek/Projects/cmok`. Czy którykolwiek z commitów dotyka:
- `useUrgentSignal.ts` callEdgeFunction
- Czy `urgent-signal` edge function ma `verify_jwt` zmienione
- `notifications.ts` registerPushToken
- `register-device` edge function
- Auth lifecycle w `app/_layout.tsx`

Jeśli NIE — wprost powiedz "Build 18 NIE adresuje Bug A ani Bug B, te bugi pozostają otwarte" i zaproponuj minimalne PR (z konkretnymi diff'ami) do Build 19.

## Output

Sekcje:
1. **Bug A — verdict + dowody** (logi, pliki, lines)
2. **Bug B — verdict + dowody**
3. **Co Build 18 faktycznie zmienia** (lista commitów z opisem skutku)
4. **Minimalny PR do Build 19** — diff dla każdego pliku + uzasadnienie
5. **Test plan** — krok po kroku jak ZWERYFIKOWAĆ że Build 19 naprawia obie rzeczy (manual + skrypt)

Quality bar: nie pisz "powinno działać". Pisz "weryfikowano przez X, wynik Y".
