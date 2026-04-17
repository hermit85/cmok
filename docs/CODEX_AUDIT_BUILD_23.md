# Codex Audit Prompt — Pre-Build 23 Final Review

## Rola

Jesteś niezależnym senior audytorem RN/Supabase. cmok właśnie zbudowana jako TestFlight Build 23 (iOS), planowany submit do Apple App Store Review w ciągu najbliższych godzin. Twoje zadanie: ostatnia linia obrony przed release. Znajdź realne bugi które:

1. Wywalają app (crash, infinite loop, white screen)
2. Blokują core flows (onboarding, SOS, daily check-in, krąg bliskich)
3. Łamią prywatność (RODO) — leak numerów telefonów lub innych PII
4. Otwierają luki bezpieczeństwa (auth bypass, push spam, privilege escalation)
5. Spowodują rejection przy Apple review (missing ATT, clinical claims, emergency service impersonation, broken account deletion)

Nie interesują nas: nazwy zmiennych, styl kodu, refactoring, optimizations — tylko twarde bugi.

**Nie ufaj raportom wcześniejszych sesji.** Czytaj kod i odpalaj zapytania na żywo (masz Supabase MCP na projekt `pckpxspcecbvjprxmdja`).

## Kontekst Build 23

**Co było naprawiane w tej sesji:**

### A. SOS 401 (Bug A z Build 18/22)

Edge functions wcześniej miały `verify_jwt: true`. Gateway odrzucał JWT (prawdopodobnie konflikt legacy anon key vs nowy publishable key), zwracał 401 zanim funkcja wystartowała. Client łapał 401, robił `signOut()`, redirect → onboarding. Klasyczny "Sesja wygasła" na SOS.

**Fix:** 5 funkcji deployed z `verify_jwt: false`: `urgent-signal`, `checkin-notify`, `nudge-signal`, `reaction-notify`, `poke-notify`. Każda ma wewnętrzną walidację przez `auth.getUser()` na początku. Weryfikuj że nadal 401/403 dla unauthenticated requests.

### B. RODO leak w useUrgentSignal (Bug z audit Build 18)

`useUrgentSignal.loadState()` robił `supabase.from('users').select('id, name, phone').in('id', userIds)` — bezpośredni SELECT który bypasuje maskowanie w `get_alert_participants` RPC. Trusted contact widział telefony innych trusted contactów.

**Fix:** [src/hooks/useUrgentSignal.ts:163-185](src/hooks/useUrgentSignal.ts:163) teraz używa `supabase.rpc('get_alert_participants', { p_alert_id })` która maskuje telefony (`CASE WHEN v_caller = u.id OR v_caller = v_pair.senior_id THEN phone ELSE NULL`). Signaler i claimer name pobierane z dodatkowych kolumn RPC (`signaler_name`, `claimer_name`).

### C. Trusted contact pending invites (NOWY FLOW)

**Problem:** Mama wpisywała Sąsiada (+48 500 000 003) do kręgu. Sąsiad nie miał konta. App pokazywała "Wyślij zaproszenie" → share link do pobrania. Sąsiad instalował app, wchodzil w onbo → pytany o rolę (signaler/recipient) → wybierał → utknął (JoinScreen żądał kodu którego nie miał). **Dead end.**

**Fix — DB:**
- Migracja: `trusted_contacts` ma kolumnę `phone` (text) i `user_id` jest nullable
- `users.role` CHECK dopuszcza `'trusted'`
- Unique index częściowy `idx_trusted_contacts_pending_uniq` na `(relationship_id, phone) WHERE user_id IS NULL`
- Trigger `users_activate_pending_trusted_insert/update` na INSERT/UPDATE users: gdy phone matchuje pending row, ustawia user_id + status='active'; jeśli user.role był NULL/empty, ustawia role='trusted'
- RPC `add_trusted_contact_by_phone` zamiast rzucać "User not found", tworzy pending row z phone
- RPC `get_trusted_circle` zwraca też pending rows z maskowaniem phone

**Fix — Client:**
- [src/types/index.ts](src/types/index.ts): `AppRole = 'signaler' | 'recipient' | 'trusted'`; `TrustedContact.userId: string | null`; `TrustedContact.status` dodane `'pending'`
- [src/utils/roles.ts](src/utils/roles.ts): normalizeAppRole obsługuje 'trusted'
- [src/hooks/useTrustedContacts.ts](src/hooks/useTrustedContacts.ts): mapping uwzględnia pending
- [src/screens/TrustedContactsScreen.tsx](src/screens/TrustedContactsScreen.tsx): handleAdd wykrywa pending (name='Oczekuje'), lista renderuje pending z "Przypomnij"/"Anuluj", osobny handler `handleCancelPendingInvite` z innym copy
- [app/onboarding.tsx](app/onboarding.tsx): `detectPendingTrustedInvite()` helper; `createProfileForRole` sprawdza pending ZANIM ustawi selectedRole — pending wins; Case 0 w handleVerified + auto-resume routują role='trusted' → `/trusted-support`

### D. Push spam vector (znaleziony w audycie)

`poke-notify` i `reaction-notify` akceptowały `to_user_id` z body bez walidacji. Dowolny zalogowany user mógł wysłać push do dowolnego user_id.

**Fix:**
- `poke-notify` [v5]: sprawdza czy caller i toUserId są w active care_pair lub jeden z nich jest trusted contactem w kręgu drugiego. 403 gdy brak relacji.
- `reaction-notify` [v4]: derives signaler z caller's active pair; gdy client przekazał toUserId, musi matchować signaler z pary (else 403); gdy brak active pair a toUserId podany → 403.

### E. Test numbers migration

`+48 100 000 00X` → `+48 500 000 00X` (PhoneVerifyScreen walidator `/^[4-8]\d{8}$/` odrzucał "100..."). Stare numery zostały w bazie (nieszkodliwe).

### F. iOS buildNumber

`app.config.ts`: 22 → 23.

## Twoje zadanie

### Krok 1: Zweryfikuj że fix SOS 401 nadal blokuje nieautoryzowany dostęp

Dla każdej z 5 funkcji (`urgent-signal`, `checkin-notify`, `nudge-signal`, `reaction-notify`, `poke-notify`):

```bash
# Bez Authorization header:
curl -X POST https://pckpxspcecbvjprxmdja.supabase.co/functions/v1/<name> \
  -H 'Content-Type: application/json' \
  -H 'apikey: <ANON>' \
  -d '{}'
# Expected: 401 "Missing authorization header"

# Z nieprawidłowym tokenem:
curl -X POST https://pckpxspcecbvjprxmdja.supabase.co/functions/v1/<name> \
  -H 'Authorization: Bearer fake.jwt.token' \
  -H 'apikey: <ANON>' \
  -d '{}'
# Expected: 401 "Unauthorized"
```

Sprawdź Supabase MCP `get_edge_function` każdej — kolejność check'ów musi być: authHeader check → auth.getUser → logika biznesowa.

### Krok 2: Zweryfikuj że poke/reaction authz naprawdę blokuje push spam

Stwórz TWÓJ własny test: scenariusz gdzie user A (zalogowany, ma test session) próbuje poke do user B z którym NIE jest w żadnym active care_pair ani trusted_contact. Musi dostać 403.

Sprawdź też edge cases:
- caller nie ma ŻADNEGO care_pair + przekazuje dowolne toUserId → 403
- caller ma care_pair z X, przekazuje toUserId=Y (≠X) → 403
- caller jest trusted contactem w parze P, toUserId to signaler z P → powinno być 200 (ma uprawnienia)

Sprawdź logikę w [poke-notify/index.ts:83-113](supabase/functions/poke-notify/index.ts:83) i [reaction-notify/index.ts:82-103](supabase/functions/reaction-notify/index.ts:82).

**Nietrivialne:** w `poke-notify` autoryzacja OR'uje care_pairs match z trusted_contacts match. Query `.or("and(...),and(...)")` — weryfikuj że Supabase PostgREST to poprawnie parsuje (nietestowane w produkcji z tym syntaxem).

### Krok 3: Trusted flow end-to-end

Scenariusz: fizyczne urządzenie nr 3 (Sąsiad). Zaczyna z czystym app (nie ma auth, nie ma profilu). Mama (500000001) wcześniej dodał +48 500 000 003 do kręgu, pending row istnieje.

1. Otwórz app → Welcome → Intent (Sąsiad wybiera np. "I am center" = signaler intent, błędnie, ale testujemy resilience)
2. Phone input → wpisuje `500 000 003` → `123456` OTP → verify
3. handleVerified wywołuje się z `profile=null` (bo users.upsert w PhoneVerifyScreen omija `role` + `name` które są NOT NULL, więc upsert FAILUJE silently dla new users — wartość z audit zweryfikowana: schema ma role i name NOT NULL bez default)
4. Case 4 wywołuje `createProfileForRole('signaler')` (intent Sąsiada)
5. `createProfileForRole` wywołuje `detectPendingTrustedInvite()` — sprawdza `trusted_contacts` gdzie `phone = '48500000003'` AND `status = 'pending'` AND `user_id IS NULL`
6. Jeśli match → effectiveRole='trusted', insert usera z role='trusted', trigger aktywuje pending row
7. createProfileForRole zwraca 'trusted', Case 4 routuje do `/trusted-support`

**Weryfikacja:**
- Czy `detectPendingTrustedInvite` poprawnie normalizuje phone? User.phone z Supabase Auth to "48500000003" bez plusa. Pending row.phone = "48500000003" (z RPC tak zapisuje, cleanup przez regexp_replace). Czy są zgodne?
- Czy trigger SECURITY DEFINER może UPDATE users w obrębie innego users INSERT? (Recursive trigger concern)
- Czy po `createProfileForRole('trusted')` i set effectiveRole, handleVerified Case 4 NIE wpada w setStep('setup'|'join') path? Grep: czy gdziekolwiek indziej `effectiveRole === 'recipient' ? 'setup' : 'join'` jeszcze działa gdy role='trusted'?

### Krok 4: Onboarding resume dla trusted

Scenariusz: Sąsiad zalogował się, wszedł na /trusted-support, potem kill app, potem znowu odpala.

1. App startuje → `app/index.tsx` → `useRelationship` fetchuje profile → role='trusted'
2. `normalizeAppRole` zwraca 'trusted' (już obsłużone)
3. index.tsx: `status === 'active'` → FALSE (trusted nie ma pary); `pendingCode` → FALSE; `status === 'pending' && role === 'recipient'` → FALSE; `hasTrustedAccess` → TRUE → `/trusted-support` ✓

**ALE** — `useRelationship` fetchProfileAndRelationship:
```
const relationshipLookupColumn = role === 'recipient' ? 'caregiver_id' : 'senior_id';
```
Dla role='trusted', zwraca `senior_id`. Zapytanie `care_pairs.eq('senior_id', user.id)` — trusted user nigdy nie jest senior, więc zwraca puste. OK.

Weryfikuj że dla role='trusted', nie robi zbędnych INSERT do pair lub niczego nie mutuje.

### Krok 5: TrustedContactsScreen pending UI

Sprawdź czy działają:
- Dodaj nieistniejący numer → pending row się pojawia w liście + invite card renderuje się nad listą (czy to OK, czy duplikacja?)
- Tap "Przypomnij" na pending row → `setNotFoundPhone(contact.phone)` → invite card pokazuje się dla tego numeru → Share sheet
- Tap "Anuluj" na pending → `handleCancelPendingInvite` → Alert "Anulować zaproszenie?" → Tak → `removeTrustedContact` (przez RPC)
- Dodaj istniejący numer (użytkownik cmok) → od razu active, toast "dodany do kręgu"

Potencjalny bug: po `handleAdd` gdy RPC zwraca pending, kod robi `setNotFoundPhone('+48 ' + displayNumber)` ALE lista już też pokazuje pending z tym numerem. Zmiana mogła przypadkiem utrzymać obydwa widoczne. Sprawdź user story.

### Krok 6: Sanity check edge functions po deployu

Każda z 5 funkcji po ostatnim deployu:
- urgent-signal v6
- checkin-notify v8
- nudge-signal v8
- reaction-notify v4
- poke-notify v5

Pull logi z ostatniej godziny (Supabase MCP `get_logs edge-function`). Poszukaj czy status_code patterns są sensowne (większość 200, sporadyczne 401 dla no-auth probe, bez masowych 500). Jeśli 500 spike → otwarty problem.

### Krok 7: Apple review killers

Szybki skan repo pod kątem rzeczy które Apple rejectuje:
- Czy `app.config.ts` ma `NSLocationWhenInUseUsageDescription` (jest)
- Czy copy nie twierdzi "medical app", "detects fall", "emergency response service" — cmok to ritual app, nie emergency. Disclaimery są? Grep: "112", "ratunkow"
- Czy delete account ([SettingsScreen.tsx:67](src/screens/SettingsScreen.tsx:67)) faktycznie usuwa konto (Apple Guideline 5.1.1 v)
- Czy są fake/placeholder screeny które trzeba usunąć przed submit (DEV_PARTICIPANTS w SignalerHomeScreen — tylko gdy pvSupport flag → OK, tylko preview)

### Krok 8: Git diff

Uruchom `git diff` w repo. Zweryfikuj że wszystkie zmiany są spójne i nic nie zostało połowicznie zrefaktorowane (np. stara ścieżka obok nowej).

## Format odpowiedzi

Sekcje:

1. **[BLOCKER]** — musi być naprawione PRZED `eas build`. Maks. 5 pozycji. Każda: file:line, co łamie, konkretny diff.
2. **[MAJOR]** — naprawić do Build 24 (po akceptacji Apple). Nie blokuje submit.
3. **[MINOR]** — nice-to-have, nie tracking.
4. **[VERIFIED WORKING]** — 3-5 rzeczy które przetestowałeś i działają (żeby nie powtarzać audytu tej samej rzeczy).
5. **[NOT VERIFIED]** — co pominąłeś (bezpieczeństwo, nie masz dostępu, wymaga fizycznego urządzenia).
6. **Verdict:** `SHIP` / `HOLD` / `NEED FIXES` z 1-liniowym uzasadnieniem.

**Twarda reguła:** "powinno działać" = nie napisane. Piszesz "przetestowałem przez X, wynik Y". Jeśli nie testowałeś — sekcja NOT VERIFIED.

Pod 1200 słów całość.

## Poza scope

Nie rób:
- Refactorów strukturalnych
- Propozycji nowych features
- Komentarzy do copy/tonu głosu (poza oczywistymi Apple rejectorami)
- Analizy performance chyba że hamuje UX (<100ms overhead jest OK)

## Artefakty

Commit hash bazowy: (do uzupełnienia przez Darka przed runem: `git rev-parse HEAD`)
Supabase project: `pckpxspcecbvjprxmdja`
Test accounts: `+48 500 000 001` (Mama/signaler, OTP 123456), `+48 500 000 002` (Darek/recipient, OTP 123456)

---

*Wygenerowane dla ostatniej bramki jakości przed Apple submit.*
