# Pre-Release Audit Prompt for cmok

Zrób ostateczny audit przed App Store submission. Nie ufaj poprzednim raportom. Zweryfikuj od zera.

## Kontekst

- App: cmok (React Native + Expo SDK 54)
- Repo: /Users/darekptaszek/Projects/cmok (app), /Users/darekptaszek/Projects/cmok-web (landing page)
- Supabase project: pckpxspcecbvjprxmdja (EU Frankfurt)
- Domena: https://cmok.app
- Data: 2026-04-13
- Test accounts: +48100000001 (signaler, OTP 123456), +48100000002 (recipient, OTP 123456)
- Invite code: 111222

## 1. Sprawdź spójność URL-i

Przeszukaj CAŁY codebase (oba repo) za:
- `cmok-web.vercel.app` — nie powinno już istnieć w kodzie app (src/), dozwolone tymczasowo w web
- `cmok.app/polityka-prywatnosci` — musi działać na produkcji
- `cmok.app/regulamin` — musi działać na produkcji
- `cmok.app/usun-konto` — musi działać na produkcji
- `kontakt@cmok.app` — stary email, powinien być `cmok.app@gmail.com` wszędzie

Wylistuj każde wystąpienie z plikiem i linią.

## 2. Sprawdź spójność legal

Porównaj te dokumenty wzajemnie i z kodem:
- `cmok-web/app/polityka-prywatnosci/page.tsx`
- `cmok-web/app/regulamin/page.tsx`
- `cmok-web/app/usun-konto/page.tsx`
- `cmok-web/app/page.tsx` (sekcja "Polityka i bezpieczeństwo" w footer)
- `cmok/src/screens/PhoneVerifyScreen.tsx` (checkbox + disclaimer)
- `cmok/src/components/UrgentConfirmation.tsx` (SOS disclaimer)
- `cmok/src/screens/SettingsScreen.tsx` (legal center links)

Sprawdź:
- Czy email kontaktowy jest wszędzie `cmok.app@gmail.com`
- Czy nazwa firmy jest wszędzie `Cybird Consulting Dariusz Ptaszek`
- Czy NIP jest poprawny: `7343126589`
- Czy adres jest poprawny: `ul. Chmielna 2/31, 00-020 Warszawa`
- Czy polityka prywatności wymienia PostHog (EU) jako podmiot przetwarzający
- Czy sekcja "Polityka i bezpieczeństwo" na LP NIE mówi "nie używa narzędzi analitycznych"
- Czy disclaimer SOS w UrgentConfirmation zawiera "nie zastępuje numeru 112"
- Czy checkbox na rejestracji linkuje do cmok.app (nie cmok-web.vercel.app)
- Czy regulamin mówi o 18+
- Czy polityka wspomina o PostHog, Supabase, Twilio, Expo Push, APNs, FCM

## 3. Sprawdź consent versioning

W pliku `cmok/src/screens/PhoneVerifyScreen.tsx` znajdź zapis consent:
- Czy zapisuje `terms_accepted_at`, `terms_version`, `privacy_version` do tabeli `users`
- Czy wersje są ustawione na `1.0`
- Czy zapis dzieje się po weryfikacji OTP

Sprawdź w Supabase:
- Czy kolumny `terms_accepted_at`, `terms_version`, `privacy_version` istnieją w tabeli `users`

## 4. Sprawdź App Privacy Labels vs rzeczywistość

App Store Connect deklaruje 6 typów danych:
- Name, Phone Number, User ID, Precise Location, Product Interaction, Other Diagnostic Data

Zweryfikuj każdy:
- Name → `users.name` — zbierane? tak
- Phone Number → `users.phone` / Supabase Auth — zbierane? tak
- User ID → `users.id` / Supabase Auth UUID — zbierane? tak
- Precise Location → `useUrgentSignal.ts` getLocation() → `alert_cases.latitude/longitude` — zbierane? tak, tylko przy SOS
- Product Interaction → PostHog events (checkin_sent, reaction_sent, etc.) — zbierane? tak
- Other Diagnostic Data → `device_installations.app_version, last_seen_at` — zbierane? tak

Czy brakuje jakiegoś typu danych który app zbiera ale NIE jest zadeklarowany?
Sprawdź szczególnie:
- Czy push token (ExponentPushToken) powinien być osobno zadeklarowany
- Czy `daily_checkins` timestamps to "Product Interaction" czy osobna kategoria
- Czy `signals` (reakcje, nudge) to osobna kategoria

## 5. Sprawdź edge functions deployment

Zweryfikuj że wszystkie 9 edge functions są ACTIVE na Supabase:
- checkin-notify (verify_jwt: true)
- nudge-signal (verify_jwt: true)
- register-device (verify_jwt: true)
- delete-account (verify_jwt: true)
- urgent-signal (verify_jwt: true)
- morning-reminder (verify_jwt: false)
- missed-sign-alert (verify_jwt: false)
- weekly-summary (verify_jwt: false)
- checkin-monitor (verify_jwt: false)

## 6. Sprawdź pg_cron

Zweryfikuj że 4 cron jobs istnieją:
- checkin-monitor: `*/30 * * * *`
- morning-reminder: `0 7 * * *` (9:00 CEST)
- missed-sign-alert: `0 18 * * *` (20:00 CEST)
- weekly-summary: `0 16 * * 0` (niedziela 18:00 CEST)

## 7. Sprawdź test data

Zweryfikuj w Supabase:
- Czy para signaler-recipient jest active
- Czy invite code `111222` istnieje jako pending z `invite_expires_at` > now()
- Czy NIE ma orphan pending pairs (duplikatów)
- Czy `signaler_label` na active pair = "Mama"
- Czy user names: signaler = "Darek", recipient = "Mama"

## 8. Sprawdź brand compliance

Przeszukaj wszystkie .tsx w src/:
- Em dash `—` w widocznym tekście UI (nie w komentarzach) — nie powinno być
- Brakujące polskie diakrytyki: szukaj "z rzedu", "lacznie", "Caly", "Swietna", "dal(a)", "Sprawdz", "Twoj" bez ogonków
- "Bliska osoba" jako fallback w miejscach gdzie powinna być konkretna nazwa
- Uppercase "Cmok" zamiast lowercase "cmok" w UI copy

## 9. Sprawdź TypeScript

Uruchom `npx tsc --noEmit` i potwierdź zero błędów.

## 10. Sprawdź dead code

Potwierdź że te pliki NIE istnieją (zostały usunięte):
- `src/screens/LocationConsentScreen.tsx`
- `src/screens/PhoneAuthScreen.tsx`
- `src/screens/VerifyCodeScreen.tsx`

## Output format

### Blokerzy release
Lista problemów które MUSZĄ być naprawione przed "Add for Review"

### Ostrzeżenia
Lista problemów które warto naprawić ale nie blokują

### Potwierdzone OK
Lista rzeczy które przeszły weryfikację

### Podsumowanie
- Czy app jest gotowa do submission? TAK/NIE
- Jeśli NIE — co dokładnie blokuje
- Top 3 ryzyka przy review
