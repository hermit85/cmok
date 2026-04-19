# cmok Final Pre-Store Audit

Data audytu: 2026-04-19  
HEAD sprawdzony: `5784b0c`

## Verdict

**FIX P0 FIRST**

Zweryfikowane live:
- `npx tsc --noEmit` przechodzi.
- 12 Edge Functions są `ACTIVE`.
- `https://cmok.app/polityka-prywatnosci`, `https://cmok.app/regulamin`, `https://cmok.app/usun-konto` zwracają `200`.
- `https://cmok.app/pobierz` zwraca `307` do App Store.
- `/.well-known/apple-app-site-association` i `/.well-known/assetlinks.json` dalej zwracają `404`, zgodnie z obecnym scope cut.
- Anonymous REST read na wszystkich 8 publicznych tabelach zwraca puste wyniki, co jest spójne z działającym RLS, ale nie jest twardym dowodem `relrowsecurity = true`.

Nie udało mi się niezależnie wyciągnąć live `pg_cron` schedule ani wyniku Supabase security advisors z narzędzi dostępnych w tej sesji, więc tych dwóch punktów nie uznaję za potwierdzone.

## P0

- [app/join/[code].tsx:62-72] Trusted invite z deeplinka jest zepsuty, `JoinScreen` rozpoznaje `kind='trusted'`, ale handler zawsze ustawia rolę `signaler` i wysyła na `/signaler-home`; poprawka: przyjąć `kind` z `onDone`, nie mutować roli dla trusted, trusted kierować na `/trusted-support`.
- [app/_layout.tsx:190-195], [ios/Cmok/PrivacyInfo.xcprivacy:61-71] Privacy disclosure nie zgadza się z kodem, aplikacja wysyła `phone` do PostHog przez `posthog.identify(...)`, a manifest deklaruje numer telefonu wyłącznie jako App Functionality; poprawka: albo przestać wysyłać telefon do PostHog przed review, albo wyrównać disclosure.

## P1

- [app/_layout.tsx:39-62], [app/_layout.tsx:190-195], [src/services/notifications.ts:39-50] Permission timing jest reviewer-hostile, ATT odpala się automatycznie po 1.5 s od startu, a push permission przy pierwszym auth hydration bez pre-prompta i bez kontekstu ekranu.
- [app/recipient-home.tsx:14-16], [app/signaler-home.tsx:14-16], [app/trusted-support.tsx:1-4] Bad-role routing nie jest szczelny, trusted trafiony w `/recipient-home` i `/signaler-home` wpada w pętlę przekierowań, a `/trusted-support` nie ma żadnego auth/role guarda.
- [src/components/PostResolveShare.tsx:73-84], [src/services/analytics.ts:58-60] SOS-resolve share ma URL typu `sos_resolved_*`, ale analytics zapisuje go jako `peer_*`, więc share attribution dla tego flow jest fałszywy.
- [src/hooks/useRelationship.ts:124-147], [src/hooks/useCircle.ts:107-115] Manual refresh dalej idzie przez cache `dedupedFetch()` zamiast `dedupedFetch.refresh()`, a offline first load po 3 retry spada do null state i routuje do onboardingu mimo istniejącej sesji.
- [ios/Cmok/Info.plist:9-10], [ios/Cmok/Info.plist:35-36], [ios/Cmok/Info.plist:49-55] Native iOS metadata w repo jest niespójna z build 27 i brandem, `CFBundleDisplayName` to `Cmok`, `CFBundleVersion` to `25`, a część location strings jest po angielsku; jeśli archiwizacja pójdzie z natywnego projektu bez pełnego syncu config pluginów, regres wróci.
- [src/utils/invite.ts:19-34], [app/join/[code].tsx:31-34] Invite attribution używa raw UUID w `?src=` i wrzuca `source_user_id` do PostHog, co jest jednocześnie privacy debt i high-cardinality debt.

## P2

- [supabase/functions/weekly-summary/index.ts:26-31] Push copy łamie brand rules, brak polskich znaków, jest chłodniejsze w tonie i używa em dash w tekście widocznym dla użytkownika.
- [supabase/functions/checkin-notify/index.ts:49-56], [supabase/functions/morning-reminder/index.ts:27] Push copy dalej zawiera em dash w user-facing stringach.
- [src/screens/RecipientHomeScreen.tsx:610-610] Samozałożenie “otwieramy tylko własne domeny + mailto/tel” jest nieprawdziwe, jest też deeplink do `maps.apple.com`; to nie jest blocker, ale trzeba przestać opisywać to inaczej.
- [app.config.ts:53-61] Android App Links są nadal włączone mimo live `assetlinks.json = 404`, więc konfiguracja i infra są chwilowo niespójne.
- [src/constants/featureFlags.ts:13-24], [src/screens/SettingsScreen.tsx:188-209] Multi-pair jest sensownie schowane za flagą, ale `/add-pair` nadal zostaje osiągalne bezpośrednim linkiem, co jest OK dla QA, nie dla szerokiego rolloutu.

## Things My Self-Audit Got Wrong

- “Trusted invite flow jest domknięty” jest nieprawdą, deeplink `/join/{code}` nadal psuje trusted role na finiszu.
- “ATT jest wymagane, bo są SDK analytics” jest nieprawdą, komentarz w kodzie to twierdzi, ale w obecnym stanie prompt wygląda raczej jak zbędny reviewer red flag niż requirement.
- “Lowercase cmok jest już wszędzie” jest nieprawdą w natywnym iOS source, `ios/Cmok/Info.plist` nadal ma `Cmok` i angielskie fallbacki.
- “Universal/App Links są gotowe poza AASA” jest zbyt optymistyczne, iOS Associated Domains są wyłączone, Android intent filter jest włączony, ale live `assetlinks.json` nie istnieje.
- “Projekt jest we Frankfurcie” jest niezgodne z live Supabase CLI, projekt `pckpxspcecbvjprxmdja` raportuje `West EU (Ireland)`.
- “RLS/advisors/pg_cron są potwierdzone” nie jest czymś, co da się uczciwie powtórzyć z tej sesji bez kanału SQL/admin; potwierdziłem tylko brak anonymous leaków i live funkcje.

## Apple Reviewer Red Flags Specific To cmok

- SMS OTP jest OK bez Sign in with Apple tylko dlatego, że 4.8 dotyczy third-party/social login, więc w review notes trzeba to nazwać wprost i podać działające numery testowe + OTP.
- SOS bez lokalnego kontekstu kulturowego może wyglądać jak pseudo-emergency app, reviewer powinien w notes dostać jasne zdanie, że to rodzinny alerting flow i że disclaimer “cmok nie zastępuje numeru 112” pojawia się przed wysłaniem.
- Jeśli zostawisz obecne prompt timing dla ATT i push, reviewer może odebrać to jako zbyt agresywne proszenie o uprawnienia w appce o ciepłym, rodzinnym use case.
- Nie opisuj Universal Links/App Links jako działających w build 27, bo live web config dalej ich nie wspiera.
- Lowercase brand jest intencjonalny, ale jeśli reviewer zobaczy `Cmok` w natywnym labelu albo angielski fallback permission string, to wygląda to jak niedopięty release, nie jak świadoma decyzja.
