# Audyt: Sprinty 1-7 Viral Growth + P2.1 Multi-Pair + Sprint 7 Attribution

Data: 2026-04-18
Scope: wszystkie zmiany od commita `e1a684a` (Build 25 baseline) do HEAD.

Celem tego audytu jest zidentyfikowanie bugów, martwego kodu, problemów
wydajnościowych i regresji wprowadzonych w sprintach 1-7 zanim zbudujemy
build 26 na TestFlight.

---

## P0 — prawdziwe bugi / regresje

### P0-1. Zduplikowane wywołania `useRelationship` w komponentach overlay

**Plik:** `src/components/MilestoneCelebration.tsx`, `src/components/PostResolveShare.tsx`
**Wprowadzone w:** Sprint 7 (commit `aff66b7`)

Oba komponenty wywołują `useRelationship()` żeby dostać `profile?.id` dla
attribution `buildPeerShareUrl`. Ale oba są renderowane wewnątrz home
screenów (RecipientHomeScreen, SignalerHomeScreen), które SAME używają
`useRelationship`. Efekt: 2-3 niezależne instancje tego samego hooka =
2-3 niezależne `supabase.from('users').select(...)` + subskrypcje
`AppState` przy każdym fg/refresh.

**Impact:** extra DB queries przy każdym mount home screenu. Nie krytyczne,
ale niepotrzebne. Także subscription leaks, jeśli cleanup nie jest idealny.

**Fix:** przekazać `srcUserId` jako prop do komponentów, pobrać raz w
home screenie. Komponenty nie potrzebują pełnego profilu, tylko `id`.

---

### P0-2. `SetupScreen.mode='additional'` — martwy kod

**Plik:** `src/screens/SetupScreen.tsx`, `app/add-pair.tsx`
**Wprowadzone w:** P2.1 (commit `ce85769`)

Rozszerzyłem `SetupScreen` o prop `mode: 'initial' | 'additional'`, ale
finalnie `AddPairScreen` jest self-contained i nie używa
`SetupScreen`. `mode='additional'` nigdy nie jest wywoływane.

**Impact:** 30 linii dead code, dezorientujące dla przyszłego dewelopera
(sugeruje że jest tam flow, którego nie ma).

**Fix:** albo usunąć prop z SetupScreen (preferowane — mniej kodu), albo
podpiąć route `/add-pair` do używać `<SetupScreen mode='additional'/>`
i usunąć `AddPairScreen` (jedno miejsce prawdy).

---

### P0-3. `moodPickedOpacity` / `moodPickedScale` — dead Animated.Values

**Plik:** `src/screens/SignalerHomeScreen.tsx`
**Wprowadzone w:** Sprint 7 polish fix (commit `3ea7cad`)

Żeby naprawić "dziurę" po wyborze statusu, zamieniłem `Animated.View`
z `opacity: moodPickedOpacity` na zwykły `View`. Ale:
- `moodPickedOpacity` + `moodPickedScale` wciąż są deklarowane (linie 352-353)
- `handleStatusPick` wciąż je ustawia i animuje (linie 367-373)
- Restore effect wciąż ustawia je (linie 394-395)
- Nikt nie czyta wartości

**Impact:** 3 Animated.Value'y jarzą się i nic nie robią. Animacja
bounce-in na pierwszy pick stracona (akceptowalne per my own commit
message), ale dependecy array useCallback wciąż je listuje.

**Fix:** usunąć deklaracje, setValue wywołania, deps w useCallback.

---

### P0-4. `primaryName` vs `sigName` — inconsistent w SignalerHomeScreen

**Plik:** `src/screens/SignalerHomeScreen.tsx`
**Istniało przed:** pre-sprint, ale dotyka nowego `statusSentPill`

`statusSentPill` używa `primaryName` ("Darek zobaczy Twój znak").
`responseReceipt` używa `responseName`. `MilestoneCelebration` dostaje
`primaryName`. W kilku miejscach screen porównuje `primaryName` do
`null`. Jest niespójność w nomenklaturze source-of-truth.

**Impact:** minor — działa, ale zwiększa cognitive load.

**Fix:** jednej zmienne lokalne `mainRecipientName = primaryName || recipients[0]?.name`.
Non-blocking.

---

### P0-5. `?src=userId` w URL — PII leak w share linkach

**Plik:** `src/utils/invite.ts` (`buildJoinUrl`, `buildPeerShareUrl`)
**Wprowadzone w:** Sprint 7

UUID użytkownika jest widoczny w tekście share (SMS/mail). Nie jest
to secret, ale:
- Pokazuje się w clipboardzie
- Pokazuje się w skopiowanym tekście
- Może wyjść w screencastach/screenshotach
- Utrwala się w czatach / historii przeglądarki

**Impact:** małe ryzyko. UUID nie daje dostępu do danych (RLS). Ale w
kontekście warmbrand cmok i dbałości o prywatność — nie-idealne.

**Fix:** hashować user_id → krótki token (HMAC-SHA256 z secretem, 8-10
znaków). Odwracanie tylko po stronie PostHog event backend lub przez
tabelę mapowań `invite_sources`.

**Odraczam:** wymaga infrastruktury (tabeli mapowań + HMAC secret).
P2 post-launch.

---

## P1 — problemy średnie

### P1-1. `Share.share` result nie sprawdzony w `TrustedSupportScreen.handleShareSenior/Family`

**Plik:** `src/screens/TrustedSupportScreen.tsx`
**Wprowadzone w:** Sprint 1

```typescript
await Share.share(...);
analytics.inviteShared('peer_senior');
```

`analytics.inviteShared` firuje niezależnie od tego czy user realnie
udostępnił (ślizgnął, cancel). W `PostResolveShare` zrobiłem poprawniej
z `if (result.action === Share.sharedAction)`. Warto wyrównać.

**Impact:** zawyża metryki `inviteShared` eventu. Myląca analityka
atrybucji. **Konkretny** problem dla metryki K-factor którą wdrażamy.

**Fix:** wszędzie sprawdzać `result.action === Share.sharedAction`
przed firem analytics.

---

### P1-2. Peer share URL nie jest trackowany po stronie appki

**Plik:** `app/join/[code].tsx`, `src/utils/invite.ts`
**Wprowadzone w:** Sprint 7

`install_via_invite` event firuje tylko gdy user ląduje na
`cmok.app/join/{code}`. Peer shares używają `cmok.app/pobierz?src=...&type=...` —
jeśli user kliknie peer link + zainstaluje + otworzy apkę, PostHog
eventu nie dostajemy (bo `/join/[code]` nie jest wywołany).

**Impact:** atrybucja peer shares wymaga web-side trackingu. Landing
page `cmok.app/pobierz` musi emit PostHog eventu (lub server-side
event do tego samego PostHog project) z `src` i `type` query params.

**Fix:** infra task w `cmok-web` — skrypt PostHog SDK na landing page
+ zapis `{ src, type }` z URL query przy pierwszym visit.

**Notka:** to był deliberate scope cut w commitcie, ale warto
zanotować w audycie.

---

### P1-3. `Colors.surfaceWarm ?? Colors.card` — niepotrzebny fallback

**Plik:** `src/screens/TrustedSupportScreen.tsx` style `viralCard`
**Wprowadzone w:** Sprint 1

```typescript
backgroundColor: Colors.surfaceWarm ?? Colors.card,
```

`Colors.surfaceWarm` istnieje w palette (`#F9EEE7`). Fallback nigdy nie
odpali. Dead code.

**Fix:** `backgroundColor: Colors.surfaceWarm`.

---

### P1-4. Nomenklatura "Krąg bliskich" nieuspójniona

**Pliki:** `src/screens/TrustedSupportScreen.tsx` (header title),
`src/screens/TrustedContactsScreen.tsx` (title)

Po Sprincie 5 `/circle` jest "Moi bliscy" (umbrella) z sekcją "Krąg
bliskich" (SOS subset). Ale `/trusted-support` ma tytuł **"Krąg bliskich"**
jako umbrella dla całego ekranu. `/trusted-contacts` też ma tytuł
**"Krąg bliskich"**. Każdy z tych ekranów używa tego samego słowa w
różnym znaczeniu.

**Impact:** mental model dla sąsiada dostającego powiadomienie: gdy
widzi "Krąg bliskich" nie wie czy to główny ekran czy podsekcja.

**Fix:** zmienić tytuł `/trusted-support` na **"Jesteś czyjąś bliską"**
lub **"Na wezwanie"**. `/trusted-contacts` pozostaje `"Krąg bliskich"`
bo to konkretny subset.

Alternatywa: rename "Krąg bliskich" na inne pojęcie ("Bezpiecznik",
"Osoby na wezwanie") — ale mocno zmienia brand. Zostawić.

---

### P1-5. `AddPairScreen` — brak invite expiry UX

**Plik:** `src/screens/AddPairScreen.tsx`
**Wprowadzone w:** P2.1

Invite code generowany jest z `invite_expires_at = now() + interval '24h'`
(jak w SetupScreen). Ale `AddPairScreen` nie pokazuje expiry. User może
wygenerować kod, zamknąć appkę, wrócić następnego dnia i kod już nie
działa — bez komunikatu.

**Impact:** confusing UX. Mama dostanie kod od Darka, nie zrobi z nim
nic przez 2 dni, wpisze → "nieznany kod". Frustracja.

**Fix:** pokazać "Kod ważny 24h" przy generowanym kodzie. I/lub wyłapać
expired invite w JoinScreen z sensowną wiadomością. JoinScreen
prawdopodobnie to robi — zweryfikować.

---

### P1-6. `AddPairScreen` — kod nie jest persyst po wyjściu

**Plik:** `src/screens/AddPairScreen.tsx`

User widzi wygenerowany kod na ekranie. Jeśli pociśnie back zanim
skopiuje → kod został zapisany w DB (pending row z `invite_code`) ale
user nie widzi go już nigdzie. Żeby go odzyskać, musi wygenerować
nowy → duplikat pending row w DB.

**Impact:** śmieciowe pending rows, zmarnowane kody. Użytkownik myśli
że coś poszło źle.

**Fix dwukierunkowy:**
- (A) Jeśli user ma active pending z current user as caregiver, ale
  on otwierał AddPairScreen ponownie, pokaż ISTNIEJĄCY pending w
  "step 2" zamiast generować nowy.
- (B) UI: "Możesz wrócić do tego kodu w Ustawieniach → Moi bliscy".

---

## P2 — nice-to-have / long-term

### P2-1. Uniwersalne Links wymagają AASA/assetlinks.json

Dokumentowane w commitcie, ale warto wyraźnie:
- `cmok.app/.well-known/apple-app-site-association`
- `cmok.app/.well-known/assetlinks.json`

Brak = share linki działają degraded (landing page + manual entry kodu).

**Blocker dla:** pełnego deep-linkingu. Build 26 może shipować bez tego,
ale K-factor attribution będzie niekompletna.

---

### P2-2. Milestone persistence per signaler — edge cases

**Plik:** `src/screens/RecipientHomeScreen.tsx`
**Sprint 3**

Klucz `cmok_recipient_last_milestone_seen_{sigId}`. Gdy:
- Sygnaler usunie konto → klucz zombieizuje się w SecureStore
- User zresetuje appkę → storage clear, milestones od nowa

**Impact:** storage leak (małe values, nieistotne). Sygnalerowi który
usuwa konto zostaje historia tego konta w SecureStore. Privacy-wise
niemały zapach ale minor.

**Fix:** okazyjny cleanup (np. przy `useEffect` init: załaduj wszystkie
klucze z prefixem, usuń te których sigId nie jest w active signalers).
Nie pilne.

---

### P2-3. Peer share copy duplikuje się w 4 miejscach

Same peer copy ("Znasz kogoś, kto mieszka sam? cmok daje codzienny
znak...") jest w:
- CircleScreen.tsx (handleSharePeer)
- TrustedSupportScreen.tsx (handleShareSenior)
- RecipientHomeScreen.tsx (handlePeerRecommend)

Każda wersja trochę inna. Jeśli chcemy A/B testować copy, teraz to
3 różne źródła zmian.

**Fix:** `src/constants/shareCopy.ts` → jeden plik z namedem variantów
(`peerSeniorMessage(url)`, `peerFamilyMessage(url, myName?)`, itp).
Jeden plik, łatwe A/B. Sprint 9 refactor.

---

### P2-4. Particles w overlay — perf concern przy współwystępowaniu

Milestone, PostResolveShare i button-tap Particle wszystkie używają
`<Particles>` komponentu. Przy milestone + reaction w tym samym
frame, 2 instance'y latających cząstek. RN Animated może dławić.

**Impact:** teoretyczny, mało prawdopodobny scenariusz.

**Fix:** nie teraz. Flag jako follow-up jeśli zobaczymy frame drops
w dev tools.

---

## Kod który usunąć (dead code cleanup dla Sprintu 9)

| Plik | Co usunąć | Powód |
|------|-----------|-------|
| `src/screens/SetupScreen.tsx` | prop `mode`, warunek w JSX + RPC | nieużywany, zobacz P0-2 |
| `src/screens/SignalerHomeScreen.tsx` | `moodPickedOpacity`, `moodPickedScale` | zobacz P0-3 |
| `src/screens/SettingsScreen.tsx` | style `inviteCard`, `inviteText`, `codeFrame` (?) | zweryfikować czy nieużywane |
| `src/screens/TrustedSupportScreen.tsx` | fallback `Colors.surfaceWarm ?? Colors.card` | zobacz P1-3 |

---

## Metryki do włączenia przed Build 26

Upewnić się że wszystkie te zdarzenia odpowiednio firują i są w PostHog:
- [ ] `invite_shared` z wariantami: `main`, `circle`, `peer_senior`,
      `peer_family`, `peer_general`, `milestone_{perspective}_{streak}d`,
      `sos_resolved_{role}`
- [ ] `install_via_invite` z `source_user_id`, `code`, `has_code`
- [ ] `milestone_reached`, `milestone_shared` (signaler + recipient)
- [ ] Metryka conversion: ilość `install_via_invite` vs `inviteShared`
      per variant

---

## Compatibility check

- [x] TypeScript: `npx tsc --noEmit` czysto po każdym sprincie ✅
- [ ] iOS build: **nie weryfikowane**, build 26 EAS potrzebny
- [ ] Android: **nie weryfikowane** — intent filters dodane, ale nie
      testowane na urządzeniu
- [ ] Testy: **brak e2e** — Sprint 11 doda

---

## Podsumowanie — co najpierw na Sprint 9 (Refactor)

1. P0-1 — przekazać `srcUserId` jako prop do `MilestoneCelebration` i
   `PostResolveShare` zamiast hook (~20 min)
2. P0-2 — usunąć martwy `mode` prop z SetupScreen (~10 min)
3. P0-3 — usunąć martwe Animated.Value w SignalerHomeScreen (~10 min)
4. P1-1 — wszędzie sprawdzać `Share.sharedAction` przed analytics
   (~15 min)
5. P1-3 — usunąć fallback `Colors.surfaceWarm ?? Colors.card` (~2 min)
6. P1-4 — rename tytułu `/trusted-support` → "Jesteś czyjąś bliską"
   (~5 min + test)
7. P1-6 — AddPairScreen resume flow (~30 min, najpracoochłonne)
8. P2-3 — centralizacja peer share copy (~30 min)

Łącznie ~2h roboty. Sprint 10 (Perf) i 11 (E2E) osobno.
