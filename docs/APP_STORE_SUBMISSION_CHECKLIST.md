# App Store Submission Checklist — build 27

Data: 2026-04-19
Target build: iOS 1.0.0 (27), waiting in TestFlight processing.

Ten dokument jest action list'ą na to, **co ZOSTAŁO DO ZROBIENIA** przed
wciśnięciem "Submit for Review" w App Store Connect. Zielone checkboxy to
rzeczy które już zweryfikowałem technicznie (kod, DB, edge functions).
Puste to rzeczy które wymagają Twojego działania w panelu App Store
Connect, w przeglądarce, albo na urządzeniu.

---

## ✅ Gotowe (zweryfikowane technicznie)

### Backend
- [x] **Edge functions** — 12 ACTIVE na Supabase: `checkin-notify`,
      `nudge-signal`, `register-device`, `delete-account`,
      `urgent-signal`, `morning-reminder`, `missed-sign-alert`,
      `weekly-summary`, `checkin-monitor`, `reaction-notify`,
      `poke-notify`, `reset-test-data`
- [x] **pg_cron** — 4 joby active: `checkin-monitor */30`,
      `morning-reminder 0 7`, `missed-sign-alert 0 18`,
      `weekly-summary 0 16 * * 0`
- [x] **RLS** — enabled na wszystkich 8 tabelach
- [x] **Migration 022** — `activate_pending_trusted_contacts` cleanup
      applied

### App binary
- [x] **Build 27 w TestFlight** — Apple procesuje
- [x] **ITSAppUsesNonExemptEncryption=false** — Export Compliance
      auto-skipped
- [x] **PrivacyInfo.xcprivacy** — wszystkie 8 zbieranych typów danych
      zadeklarowane (Name, Phone, User ID, Precise Location, Product
      Interaction, Crash Data, Performance Data, Other Diagnostic Data)
- [x] **Permission copy** — `NSLocationWhenInUseUsageDescription` OK,
      `userTrackingPermission` OK (lowercase cmok)
- [x] **Bundle ID** — `com.hermit85.cmok`
- [x] **App Scheme** — `cmok://` (custom scheme działa)
- [x] **Portrait-only** — OK (`orientation: 'portrait'`)
- [x] **Privacy manifest API reasons** — FileTimestamp, UserDefaults,
      SystemBootTime, DiskSpace — wszystkie zadeklarowane

### Landing page (cmok.app)
- [x] `/polityka-prywatnosci` — 200
- [x] `/regulamin` — 200
- [x] `/usun-konto` — 200
- [x] `/pobierz` — 307 redirect (normalne, user-agent based)
- [ ] `/.well-known/apple-app-site-association` — **404** (Universal Links
      nie działają; NIE blokuje review, tylko degraduje UX share linków)
- [ ] `/.well-known/assetlinks.json` — **404** (Android App Links; same
      story)

---

## 🔨 Do zrobienia — App Store Connect panel

### 1. App Information (wymagane)
- [ ] **Primary Category** — wybierz jedną (sugestia: **Health & Fitness**
      lub **Lifestyle**; *NIE* Social Networking bo to zmienia
      wymagania Privacy)
- [ ] **Secondary Category** — opcjonalnie
- [ ] **Content Rights** — zaznacz "Does not use third-party content"
      (cmok nie używa contentu third-party w apce)

### 2. Pricing and Availability
- [ ] **Price** — Free
- [ ] **Availability** — wybierz kraje (minimum: Polska; rozważ inne EU
      jeśli polska diaspora testing)

### 3. Privacy (krytyczne)
- [ ] **Privacy Policy URL** — `https://cmok.app/polityka-prywatnosci`
- [ ] **App Privacy** → **Data Types Collected** — wejdź i zadeklaruj
      8 typów (musi się zgadzać z PrivacyInfo.xcprivacy który właśnie
      zaktualizowałem):
      - [ ] **Name** — Linked to User, Not Tracking, Purposes:
            App Functionality
      - [ ] **Phone Number** — Linked, Not Tracking, App Functionality
      - [ ] **User ID** — Linked, Not Tracking, App Functionality +
            Analytics
      - [ ] **Precise Location** — Linked, Not Tracking, App
            Functionality (sub-purpose: only during SOS)
      - [ ] **Product Interaction** — Linked, Not Tracking, Analytics +
            App Functionality
      - [ ] **Crash Data** — Not Linked, Not Tracking, App Functionality
      - [ ] **Performance Data** — Not Linked, Not Tracking, App
            Functionality
      - [ ] **Other Diagnostic Data** — Linked, Not Tracking, App
            Functionality
- [ ] **Data Used to Track You** — **none** (check "We do not use data
      to track the user")

### 4. App Store page content (wymagane)
- [ ] **App Name** — `cmok` (lowercase! ASC niestety często wymusza
      Capitalize; jeśli odrzuci, użyj `Cmok`)
- [ ] **Subtitle** (≤30 znaków) — sugestia: *"codzienny znak bliskości"*
- [ ] **Promotional Text** (≤170 znaków) — sugestia:
      > Jeden gest dziennie dla bliskiej osoby. cmok daje spokój Tobie
      > i jej. Bez dzwonienia, bez stresu. Krąg bliskich na wypadek
      > gdyby coś się działo.
- [ ] **Description** (≤4000 znaków) — ułóż w sekcjach:
      - Co to jest (1 akapit)
      - Dla kogo (senior + rodzina)
      - Jak działa (codzienny znak, reakcje, krąg bliskich, SOS)
      - Prywatność (wszystko po polsku, EU, RODO, minimalne dane)
      - Wsparcie
- [ ] **Keywords** (≤100 znaków, oddzielone przecinkami) — sugestia:
      `senior,rodzina,bliskość,spokój,zdrowie,rodzic,babcia,mama,
      sąsiad,codzienny,znak,check-in`
- [ ] **Support URL** — `https://cmok.app` (lub `https://cmok.app/pomoc`
      gdy stworzysz)
- [ ] **Marketing URL** — opcjonalnie `https://cmok.app`
- [ ] **Copyright** — `2026 Cybird Consulting Dariusz Ptaszek`

### 5. Screenshots (wymagane)
Apple wymaga **iPhone 6.7"** (np. 17 Pro Max, 16 Pro Max) — **minimum
3, max 10**. Rekomenduję 6-8 screenshotów:

- [ ] Signaler home z dużym "daj znak" kółkiem (pending)
- [ ] Signaler home po check-in: "Gotowe ✓" + week dots
- [ ] Recipient home: "Jest znak ✓" + reakcje
- [ ] Recipient po reakcji: pill "Mama zobaczy Twój gest"
- [ ] /circle view: "Moi bliscy" z Darek → codzienny znak → Mama
- [ ] SOS flow: urgent state z uczestnikami kręgu
- [ ] Krąg bliskich list z copy "Gdy Mama poprosi o pomoc..."
- [ ] Opcjonalnie: milestone celebration (30 dni!)

**Jak zrobić:** symulator iPhone 17 Pro Max (6.7") → Cmd+S screenshot.
Nie używaj mockupów marketingu — Apple chce real UI. W Settings
simulatora możesz ustawić czas na `19:41` żeby było ładnie.

- [ ] **iPad screenshots** — nie wymagane (`supportsTablet: false`)

### 6. App Review Information (krytyczne — oto gdzie reviewer zaczyna)
- [ ] **Sign-In Information** → tak, wypełnij:
      - **Username:** `+48 500 000 002` (Darek, recipient)
      - **Password:** `123456` (to jest OTP z Supabase seed, nie hasło)
      - **Instructions:**
        > cmok uses SMS OTP (no password). Use these test phones with
        > code 123456:
        > - `+48 500 000 001` — signaler (Mama)
        > - `+48 500 000 002` — recipient (Darek)
        > - `+48 500 000 003` — trusted contact (Sąsiad)
        >
        > Before testing, please run this to reset test state (POST,
        > include the secret header we'll email you separately):
        > curl -X POST
        > https://pckpxspcecbvjprxmdja.supabase.co/functions/v1/reset-test-data
        > -H "Content-Type: application/json"
        > -H "x-reset-secret: <SECRET>"
        > -d '{"mode": "seed_apple_review"}'
        >
        > This sets Darek↔Mama as an active pair with today's sign
        > already received, so the reviewer lands on a populated home
        > screen.
- [ ] **Contact Information:**
      - Name: `Dariusz Ptaszek`
      - Phone: Twój numer
      - Email: `cmok.app@gmail.com` (lub Twój)
- [ ] **Notes** — dopisz:
      > cmok is a daily closeness ritual app for people living apart.
      > Signaler (usually elderly parent) sends one daily sign; recipient
      > (adult child) sees it and reacts. Trusted circle gets an SOS
      > signal when the signaler explicitly triggers it.
      >
      > - SMS OTP bypass for test phones is ONLY for the three numbers
      >   above; all other phones go through real Twilio SMS.
      > - The "potrzebuję pomocy" (SOS) button sends push notifications
      >   to the circle. It's NOT a medical emergency service — we
      >   explicitly say "cmok nie zastępuje numeru 112" in the flow.
      > - No in-app purchases, no ads, no third-party tracking.
      > - EU-only data processing (Supabase Frankfurt, Sentry Germany,
      >   PostHog EU).

### 7. Version Release
- [ ] **Manual Release** — zaznacz (żebyś ty decydował kiedy go
      publicznie wystawić po approve)
- [ ] **Automatic Release as soon as possible** — alternatywnie, jeśli
      jest gotów od razu publikować

### 8. Age Rating
- [ ] W ASC → App Information → Age Rating → wypełnij kwestionariusz.
      Dla cmok: **4+** jest realistyczne (brak przemocy, brak
      seksu, brak hazardu, brak alkoholu). Jedyne co zaznaczysz to:
      - Unrestricted Web Access: **No**
      - Wszystko inne: **None**

---

## 🧪 Do zrobienia — Własny smoke test TestFlight

Przed submit'em wyślij build 27 do swojej grupy TestFlight i zrób
**5-minutowy ręczny test**:

- [ ] Zainstaluj build 27 na fizycznym iPhone (inny niż simulator)
- [ ] Zaloguj się jako Mama (`+48 500 000 001`, OTP `123456`)
- [ ] Zrób check-in — zobacz "Gotowe" + mood picker
- [ ] Wybierz mood "Spokojnie" — zobacz oba pille
- [ ] Przejdź do Ustawienia → Moi bliscy — sprawdź nową copy
- [ ] Wyloguj się, zaloguj jako Darek (`+48 500 000 002`)
- [ ] Zobacz "Jest znak" + wyślij reakcję ❤️
- [ ] Przejdź do Krąg bliskich Mamy — sprawdź nową copy
- [ ] Dodaj numer który nie ma cmok (dowolny) — sprawdź invite flow
- [ ] Wyślij share przez WhatsApp — wróć do appki — sprawdź że buttons
      DZIAŁAJĄ (nie "dead")
- [ ] Zamknij appkę, otwórz ponownie — sprawdź że stan się zachował
- [ ] Usuń konto i sprawdź czy delete działa clean

Jeśli coś jest "off" → wycofaj submit review, napraw, build 28.

---

## ⚠️ Uwagi / znane ograniczenia

### Universal Links (iOS) + App Links (Android) — NIE działają
- AASA + assetlinks.json na cmok.app to **404**
- Zamiast tego share link prowadzi na landing page, user sam wpisuje kod
- To **nie jest ship blocker** — apka działa, share działa, tylko UX
  jest 2-click zamiast 1-click
- TODO post-launch: deploy AASA + assetlinks na cmok.app → w build 28
  wróć `associatedDomains: ['applinks:cmok.app']` w `app.config.ts` +
  `eas credentials --clear-provisioning-profile` + nowy build

### Multi-pair CTA ukryty
- `MULTI_PAIR_ENABLED = false` w `src/constants/featureFlags.ts`
- CTA "Zaproś kolejną bliską osobę" nie renderuje się w Settings
- Feature istnieje w kodzie ale nie jest exposed, bo RecipientHome nadal
  pokazuje tylko signalers[0]
- Post-P2.2 (multi-status home screen) flip na `true`

### Export compliance + capabilities
- Export Compliance: **już rozwiązane** (ITSAppUsesNonExemptEncryption)
- Associated Domains capability: **wyłączone** na App ID (było blocker
  build 26, zostawione off dla 27). Wróci jak infra cmok.app AASA
  dostarczy.

### PostHog EU vs US
- Upewnij się że PostHog project używany przez apkę to **EU region**
  (`eu.posthog.com`). Polityka prywatności to deklaruje — niezgodność
  = RODO problem.

### Supabase project region
- Project `pckpxspcecbvjprxmdja` powinien być w EU (Frankfurt). Sprawdź
  w Supabase dashboard → Settings → Region.

---

## 📊 Po approve — co tracking w PostHog

Pierwsze 2 tygodnie patrz na:

- `invite_shared` — podział po `type`: `main`, `circle`, `peer_senior`,
  `peer_family`, `peer_general`, `milestone_*`, `sos_resolved_*`
- `install_via_invite` — join z jakiego `source_user_id` / `has_code`
- `milestone_reached` / `milestone_shared` (perspective + variant)
- `checkin_sent` — konwersja onboarding → first sign
- `reaction_sent` — engagement recipienta
- `urgent_triggered` / `urgent_resolved` — SOS funnel

Funnel do zbudowania:
1. `install_via_invite` → 2. onboarding_complete → 3. first check-in →
4. first reaction → 5. 7-day retention

Jeśli K < 1 po 2 tygodniach:
- Sprawdź który wariant `invite_shared` konwertuje najlepiej
- Skup się na najsłabszej krawędzi grafu (patrz
  `AUDIT_VIRAL_SPRINTS.md`)
