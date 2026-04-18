# Codex Review — Viral Growth + Multi-Pair + Attribution Sprints

Data audytu: 2026-04-18  
Scope: commity `7102cc8` through `ab21c3b`, reviewed from `e1a684a` baseline through HEAD.

## Verdict

**fix P0 first**

Największy problem nie jest w peer-share ani w milestone'ach. Największy problem jest taki, że **multi-pair jest wystawione w UI, ale dalej działa jak aplikacja single-signaler**. Po dołączeniu drugiej osoby recipient dalej bierze `signalers[0]` z nieuporządkowanej listy i cały home screen może pokazać arbitralnie złą osobę.

Drugi mocny wniosek: **repo i live Supabase nie są już tym samym światem**. Trusted-invite flow działa częściowo dzięki zmianom live i fallbackowi w kliencie, ale repo nie zawiera triggera, na który powołują się `CLAUDE.md` i poprzedni audyt, a live trigger nie robi dokładnie tego, co jest opisane.

## Co sprawdziłem

- Commit scope potwierdzony: sprinty 1-11 są w zakresie `e1a684a..HEAD`.
- Kod appki przeczytany bez polegania na `docs/AUDIT_VIRAL_SPRINTS.md`.
- Live Supabase sprawdzony przez:
  - `supabase functions list --project-ref pckpxspcecbvjprxmdja`
  - OpenAPI z `rest/v1/`
  - RPC testy na prawdziwym projekcie
  - insert test na `care_pairs` pod constraint
- `npx tsc --noEmit`: przeszło.
- `npx expo export --platform ios --output-dir dist`: przeszło.
- Bundle delta vs `e1a684a`: Hermes bundle `5,615,187 B` vs `5,582,789 B`, wzrost `32,398 B`, czyli ok. `31.6 KB`.
- Maestro: **niezweryfikowane runtime**, bo `maestro` nie jest zainstalowane w tym środowisku.

## DB / schema — live verification

### Potwierdzone live

- Public REST OpenAPI pokazuje dokładnie 8 tabel: `users`, `device_installations`, `care_pairs`, `daily_checkins`, `alert_cases`, `alert_deliveries`, `signals`, `trusted_contacts`.
- `care_pairs.senior_id` jest nullable:
  - live OpenAPI nie oznacza go jako required
  - live dane zawierają pending rows z `senior_id = null`
- Unikalność `(senior_id, caregiver_id)` nadal działa:
  - próbny duplicate insert zwrócił `23505 duplicate key value violates unique constraint "care_pairs_senior_id_caregiver_id_key"`
- `trusted_contacts.user_id` jest nullable i `phone` działa jako fallback:
  - live pending row miał `user_id = null`, `phone = 48599900001`, `invite_code`, `invite_expires_at`
- Edge functions: live projekt ma dalej 12 funkcji, bez nowych funkcji dodanych w tym oknie.

### Potwierdzone live, ale nie tak jak twierdzi dokumentacja

- RPC `add_trusted_contact_by_phone` dla istniejącego numeru cmok:
  - zwraca `active`
  - `user_id` ustawione
  - `out_invite_code = null`
- RPC `add_trusted_contact_by_phone` dla numeru spoza cmok:
  - zwraca `pending`
  - generuje 6-cyfrowy `out_invite_code`
  - zapisuje `invite_expires_at` na 30 dni

### Rozjazd live vs repo

- Repo migrations nie zawierają triggera `users_activate_pending_trusted_insert` ani funkcji `activate_pending_trusted_contacts`.
- Live trigger najwyraźniej istnieje, bo po insert do `public.users`:
  - pending `trusted_contacts` row przeszedł na `status = active`
  - `user_id` zostało podpięte
  - `phone` zostało wyczyszczone
- Ale live trigger **nie** robi wszystkiego, co opisują `CLAUDE.md` i poprzedni audyt:
  - zostawia `invite_code`
  - zostawia `invite_expires_at`
  - nie promuje profilu do `role = 'trusted'`

### Czego nie mogłem uczciwie potwierdzić live

- `RLS enabled on all 8 tables`

Repo migrations włączają RLS na wszystkich 8 tabelach, ale w tym środowisku nie miałem dostępu do live `pg_class.relrowsecurity` ani pg-meta/SQL MCP. Traktuję to jako **repo-verified, not live-catalog-verified**.

## P0 (blocks ship)

- [src/screens/RecipientHomeScreen.tsx:254](src/screens/RecipientHomeScreen.tsx), [src/hooks/useCircle.ts:40](src/hooks/useCircle.ts) Multi-pair jest half-wired. Recipient home bierze `signalers[0]`, a `useCircle()` nie nakłada żadnego `order by`, więc po dołączeniu drugiej aktywnej osoby "główna" osoba staje się arbitralna. To wpływa na hero copy, week dots, streak, reakcje, trusted contacts, call button i cały recipient flow. Jeśli CTA "Zaproś kolejną bliską osobę" zostaje w buildzie, to to nie jest edge case, tylko realny runtime bug.

## P1 (ship but track)

- [src/screens/AddPairScreen.tsx:86](src/screens/AddPairScreen.tsx), [src/utils/invite.ts:150](src/utils/invite.ts) `AddPairScreen.handleShare()` dubel-countuje `invite_shared`. `shareInvite()` już liczy analytics tylko dla realnego share, a `AddPairScreen` po `await` wali jeszcze `analytics.inviteShared('main')` zawsze, także po cancelu. To zniekształca cały funnel dla P2.1.
- [src/components/PostResolveShare.tsx:73](src/components/PostResolveShare.tsx), [src/services/analytics.ts:59](src/services/analytics.ts) URL ma poprawny variant `sos_resolved_{role}`, ale analytics event nie. `PostResolveShare` loguje `peer_general|peer_family|peer_senior`, więc PostHog nie odróżnia post-SOS share od zwykłego peer-share. Commit message Sprintu 7 obiecuje więcej niż realnie mierzymy.
- [src/screens/TrustedContactsScreen.tsx:91](src/screens/TrustedContactsScreen.tsx), [app/join/[code].tsx:17](app/join/[code].tsx) Trusted invite dalej nie niesie `?src=`. Link ma kod, ale `install_via_invite` w `/join/[code]` czyta `src` wyłącznie z query param. Efekt: trusted-contact install/join wpada bez `source_user_id`, mimo że commit `aff66b7` był opisany jako pełne src tracking.
- [supabase/functions/reset-test-data/index.ts:1](supabase/functions/reset-test-data/index.ts), [docs/E2E_TESTS.md:31](docs/E2E_TESTS.md) Step 4 z promptu nie dał się wykonać tak, jak jest opisany. `curl` bez auth zwraca `401 Unauthorized`. Ten sam `401` dostałem także z authed user tokenem i z legacy `service_role` key. Dokumentacja i komentarze mówią "no JWT required", live projekt mówi co innego. To blokuje powtarzalne QA i czyni Sprint 11 mniej użytecznym.
- Live Supabase, verified against `trusted_contacts` + onboarding fallback Trigger trusted-activation jest tylko częściowo poprawny. Pending trusted contact aktywuje się po insert do `public.users`, ale row nie czyści `invite_code`/expiry i nie ustawia `users.role = 'trusted'`. Aplikacja maskuje ten problem przez [app/onboarding.tsx:96](app/onboarding.tsx), który sam wykrywa pending invite i wymusza rolę `trusted`, ale DB contract opisany w `CLAUDE.md` i self-audicie jest nieprawdziwy.
- [docs/E2E_TESTS.md:34](docs/E2E_TESTS.md), [.maestro/onboarding-recipient.yaml:12](.maestro/onboarding-recipient.yaml), [.maestro/onboarding-signaler.yaml:15](.maestro/onboarding-signaler.yaml), [.maestro/checkin-flow.yaml:11](.maestro/checkin-flow.yaml), [.maestro/sos-flow.yaml:25](.maestro/sos-flow.yaml) Sprint 11 scaffolding jest stale względem aktualnego UI. Przykłady:
  - onboarding recipient tapuje `Dostaję codzienny znak`, ale simplified intent screen pokazuje `Chcę zaprosić bliską osobę`
  - onboarding recipient oczekuje `Udostępnij`, a waiting screen ma `Wyślij zaproszenie`
  - onboarding signaler tapuje `Daję codzienny znak`, ale simplified screen startuje od `Mam kod zaproszenia`
  - checkin-flow oczekuje `daj znak`, a UI renderuje `Daj znak`
  - sos-flow po wysłaniu oczekuje `Coś się dzieje`, ale signaler urgent screen ma `W toku` / `Krąg bliskich dostał sygnał`
- [src/screens/AddPairScreen.tsx:33](src/screens/AddPairScreen.tsx) Known issue P1-6 nadal otwarty. Pending row powstaje od razu przy `handleCreate()`, a wyjście z ekranu nie ma żadnego cleanup ani resume. To nie tylko UX gap, to też realne śmiecenie `care_pairs` pending rows. Dodatkowo live baza już miała taki wiszący pending row.
- [src/screens/TrustedSupportScreen.tsx:24](src/screens/TrustedSupportScreen.tsx) `useRelationship()` jest użyte tylko po `profile?.id` do attribution. To nie psuje runtime, ale wrzuca pełny, droższy hook tam, gdzie wystarczy `useAuthedUserId()`. Po Sprint 10 to jest już wyraźny outlier.
- [src/screens/AddPairScreen.tsx:114](src/screens/AddPairScreen.tsx) Code frame mówi "Dotknij, żeby skopiować", ale samo pole kodu nie jest klikalne. Kopiowanie działa tylko z osobnego buttona. To drobne, ale mylące.

## P2 (follow-up)

- [src/components/PostResolveShare.tsx:36](src/components/PostResolveShare.tsx), [src/screens/RecipientHomeScreen.tsx:542](src/screens/RecipientHomeScreen.tsx), [src/screens/TrustedContactsScreen.tsx:95](src/screens/TrustedContactsScreen.tsx) Brand drift: w nowych tekstach share dalej są em dashes `—`, mimo twardej zasady "bez em dashy w UI copy". To nie wywala runtime, ale łamie ustalone zasady brandu.
- [src/screens/TrustedSupportScreen.tsx:96](src/screens/TrustedSupportScreen.tsx) `Jesteś na wezwanie` działa semantycznie, ale brzmi chłodno i trochę instytucjonalnie. Lepsza, cieplejsza alternatywa: `Jesteś blisko, gdy trzeba`.
- [src/components/MilestoneCelebration.tsx:73](src/components/MilestoneCelebration.tsx) Milestone flow jest poprawnie przepięty na `srcUserId` prop i nie widzę dubla fire na race `effOk` + `sigStreak`, ale nadal loguje tylko `milestone_shared(streak)`, bez perspective i variantu. Jeśli to ma wejść do realnej analityki growth, będzie za płaskie.
- [app.config.ts:6](app.config.ts) Lowercase brand nadal nie jest konsekwentny w app metadata i permission copy (`Cmok`). To nie jest sprint-specific blocker, ale nadal jest widoczne użytkownikowi.

## What actually works

- Sprint 1 trusted dead-end unblock:
  - empty state ma dokładnie 2 viral cards
  - analytics w `TrustedSupportScreen` są już po `Share.sharedAction`
  - `buildPeerShareUrl(profile?.id, 'peer_senior|peer_family')` jest użyte poprawnie
  - runtime działa, ale hook choice jest cięższy niż trzeba
- Sprint 2 recipient peer rec:
  - karta jest na dole scrolla, po `rhythmSection`
  - gate to `!pv && effWeek.some(d === 'ok')`
  - `useAuthedUserId()` zastąpił `useRelationship()` dla attribution
  - preview modes nie pokazują tej karty w ogóle
- Sprint 3 milestone:
  - perspective copy jest poprawnie rozdzielone
  - ladder `[7,14,21,30,50,100,365]` jest zaimplementowana
  - per-signaler persistence key jest poprawny
  - nie widzę podwójnego fire od race `effOk` + `sigStreak`
- Sprint 4 PostResolveShare:
  - wszystkie 3 ekrany ustawiają overlay dopiero po sukcesie `resolve()`
  - `srcUserId` jest przepchnięty propem, nie hookiem lokalnym
  - URL variant jest poprawny, analytics variant nie
- Sprint 5 IA:
  - Settings mają jedną kartę "Moi bliscy"
  - `/circle` ma tytuł "Moi bliscy"
  - stare style safety-card są usunięte
  - `/trusted-support` nie nazywa się już "Krąg bliskich"
- Sprint 10 perf:
  - `useAuthedUserId` używa `getSession()` + `onAuthStateChange()`
  - `WeekDots` jest `memo()` z sensownym comparator
  - w normalnym runtime memo ma szansę działać, bo `useWeekRhythm` trzyma `days` w state i parent przekazuje ten sam ref między unrelated re-renderami

## Brand / voice QA

### Dobre

- `cmok` w nowych screen texts jest w większości lowercase.
- Recipient milestone copy jest ciepłe i po polsku.
- Recipient peer card i AddPairScreen brzmią naturalnie, nie technicznie.

### Słabsze

- `Jesteś na wezwanie` jest poprawne funkcjonalnie, ale nie brzmi jak cmok.
- Share copy nadal ma em dashes:
  - post-resolve signaler
  - post-resolve trusted
  - recipient peer recommend
  - trusted invite
- Share copy w trusted invite i post-resolve jest bardziej "kampanijne" niż intymne.

## Bundle / perf notes

- Current export: `dist` = `14M`
- Baseline `e1a684a`: `dist-baseline` = `13M`
- Hermes bundle delta: `+32,398 B`
- To mieści się w oczekiwanym limicie `< 50 KB`

Nie widzę tu istotnej regresji bundle size od samego viral stacka.

## Agreement / disagreement with `docs/AUDIT_VIRAL_SPRINTS.md`

### Agree, and now fixed

- P0-1 overlay `useRelationship` duplication: zgoda, naprawione przez `srcUserId` props.
- P0-2 dead `SetupScreen.mode`: zgoda, naprawione.
- P0-3 dead mood Animated values: zgoda, naprawione.
- P1-1 `Share.sharedAction` missing in `TrustedSupportScreen`: zgoda, naprawione.
- P1-3 `Colors.surfaceWarm ?? Colors.card`: zgoda, naprawione.
- P1-4 nomenclature collision around `/trusted-support`: zgoda co do problemu, częściowo naprawione.

### Agree, still open

- P1-2 peer-share attribution nie kończy się in-app: zgoda. Nadal scope cut.
- P1-5 brak expiry UX w AddPair: zgoda.
- P1-6 brak resume / cleanup dla AddPair pending row: zgoda, nadal otwarte.
- P2-1 Universal Links wymagają AASA / assetlinks: zgoda.
- P2-2 milestone persistence edge cases: zgoda, minor.
- P2-3 peer-share copy duplication: zgoda, ale większym realnym problemem jest dziś brak spójnego brand copy i em dashes.

### Disagree or downgrade

- P0-4 `primaryName` vs `sigName`: nie widzę tego jako realny bug, tylko naming debt.
- P0-5 raw UUID in `src=`: nie jest to P0. To nie daje dostępu do danych. Natomiast jako produkt prywatnościowy i rodzinny, **przed szerszym public launch** i tak zrobiłbym opaque source token zamiast surowego UUID.
- P2-4 particles perf concern: nie znalazłem dowodu na regresję, a bundle/perf delta wygląda zdrowo.

## Bugs the self-audit missed

- `AddPairScreen` dubel-countuje `invite_shared`.
- Trusted invite path nie niesie `src`, więc attribution coverage nie jest pełna.
- `reset-test-data` docs i prompt są fałszywe względem live projektu, `401 Unauthorized`.
- Live trigger dla pending trusted contacts nie czyści `invite_code`/expiry i nie ustawia `role='trusted'`.
- Multi-pair jest dużo bardziej problematyczne niż opisane, bo recipient home działa na nieuporządkowanym `signalers[0]`.

## Final take

Jeśli build 26 ma pokazywać CTA multi-pair, to najpierw naprawiłbym P0 albo schował ten feature. Reszta viral stacka jest w większości realna, ale analytics i QA scaffolding są mniej wiarygodne niż wynika z poprzedniego audytu, a live Supabase trusted flow ma ewidentny drift względem repo i dokumentacji.
