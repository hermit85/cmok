# Codex Double-Check: Viral Growth + Multi-Pair + Attribution Sprints

## Context

cmok is a React Native + Expo app for a daily closeness ritual between
people living apart. Roles:
- `signaler` — gives one daily sign ("daj znak")
- `recipient` — receives the sign and reacts
- `trusted` — in the SOS circle, notified only on urgent signal

Tech stack:
- React Native + Expo SDK 54
- expo-router
- Supabase: Auth (SMS OTP), Postgres with RLS, Edge Functions,
  Realtime
- PostHog for product analytics

Project path:
- `/Users/darekptaszek/Projects/cmok`

Date of audit window: 2026-04-18
Commit range to review: from `e1a684a` (Build 25 baseline) through HEAD.

Test accounts (CLAUDE.md):
- recipient: `+48 500 000 002` (Darek), OTP `123456`
- signaler:  `+48 500 000 001` (Mama),  OTP `123456`
- trusted:   `+48 500 000 003` (Sąsiad), OTP `123456`

Brand rules (strict):
- lowercase `cmok` everywhere
- warm Polish copy, no em dashes in UI (commas instead)
- correct Polish diacritics required (ą ę ć ś ź ż ó ł ń)
- never say "user", say "bliska osoba"
- never say "circle", say "krąg bliskich"

## Your task

Do an independent verification audit of Sprints 1-11 (commits
`7102cc8` through `ab21c3b`). I (the preceding Claude instance) have
already self-audited in `docs/AUDIT_VIRAL_SPRINTS.md` — **do not trust
that document**. Verify the claims by reading the code directly, the
database schema, and running your own reasoning.

Your job is to separate:

1. what actually works vs. what is half-wired,
2. what passes type-check but fails at runtime,
3. what has RLS / security implications,
4. what brand/voice drift exists in the new copy,
5. what performance regressions were introduced,
6. what bugs the first audit missed.

## Step 1: Confirm the scope

```bash
cd /Users/darekptaszek/Projects/cmok
git log e1a684a..HEAD --oneline
```

You should see commits for Sprints 1 through 11. Roughly:
- Sprint 1: `feat(viral): unblock trusted dead-end...`
- Sprint 2: `feat(viral): peer recommendation card on recipient home`
- Sprint 3: `feat(viral): recipient milestone celebration...`
- Sprint 4: `feat(viral): share moment after SOS resolved`
- Sprint 5: `refactor(ia): unify "Moi bliscy"...`
- Sprint P2.1: `feat(multi-pair): caregiver can invite additional signaler`
- Sprint 7: `feat(attribution): deep-link share URLs + Universal Links...`
- Polish: symmetrical sent-feedback, content flow fix, pill Animated fix
- Sprint 8: docs audit
- Sprint 9: refactor applying P0/P1 findings
- Sprint 10: `perf(sprint-10): lighter hook + memoize WeekDots`
- Sprint 11: Maestro e2e scaffolding

## Step 2: Verify database state

Connect to Supabase project `pckpxspcecbvjprxmdja` via MCP. Confirm
these schema invariants still hold — the viral work should not have
touched DB but a regression would be severe:

- `care_pairs.senior_id` can be NULL (for pending additional pairs
  created by AddPairScreen)
- `UNIQUE(senior_id, caregiver_id)` on care_pairs
- `trusted_contacts` has `user_id` NULL-able + `phone` fallback
- RLS enabled on all 8 tables (CLAUDE.md: "enabled na wszystkich 8
  tabelach")
- Edge functions: no new ones added this window
- Triggers: `users_activate_pending_trusted_insert` still fires
  `activate_pending_trusted_contacts` (CLAUDE.md trusted contact
  invite flow)

Verify the RPC `add_trusted_contact_by_phone` is unchanged — it
should still:
- Detect existing cmok user by phone match → insert trusted_contacts
  with `status='active'`, no invite_code
- No match → insert `status='pending'` + generate 6-digit
  invite_code + 30-day expiry

## Step 3: Critical runtime paths

For each, read the code and decide if it actually works end-to-end.
Don't just check that TypeScript compiles.

### 3.1 Trusted user dead-end unblock (Sprint 1)

Files:
- `src/screens/TrustedSupportScreen.tsx`
- `src/services/analytics.ts`

Verify:
- Empty state (no active SOS) renders `"A u Ciebie?"` section with
  exactly 2 cards: peer_senior (terracotta) and peer_family (teal)
- Each card's `handleShare*` fires `analytics.inviteShared` only when
  `result.action === Share.sharedAction` (post-Sprint 9 fix)
- `buildPeerShareUrl` is imported and the URL is
  `cmok.app/pobierz?src={uid}&type=peer_senior|peer_family`
- `useRelationship` is used to get `profile.id` — is this the right
  hook here, or should it also be swapped to `useAuthedUserId`?

### 3.2 Recipient peer rec (Sprint 2)

File: `src/screens/RecipientHomeScreen.tsx`

Verify:
- Card renders only when `effWeek.some(d => d === 'ok')` — i.e. user
  has seen at least one sign. Check whether this gate is correct for
  preview modes too.
- Card appears at the **bottom** of the scroll, below `rhythmSection`
- Post-Sprint 10, `myUserId` comes from `useAuthedUserId()` not
  `useRelationship()`. Confirm the hook returns the right id on
  realistic auth state transitions (logout → login).

### 3.3 Recipient milestone celebration (Sprint 3)

Files:
- `src/components/MilestoneCelebration.tsx`
- `src/screens/RecipientHomeScreen.tsx`

Verify:
- Perspective prop is wired through: signaler side gets "Jesteś
  niesamowita" copy, recipient side gets "Mama daje znak siedem dni
  z rzędu".
- Extended milestone ladder `[7, 14, 21, 30, 50, 100, 365]` fires
  exactly once per milestone-per-signaler (SecureStore key
  `cmok_recipient_last_milestone_seen_{sigId}`).
- Race condition check: if `dbStatusEmoji` and `sigStreak` both flip
  in the same render, does the milestone fire twice?
- `srcUserId` prop is passed from parent (post-Sprint 9 refactor).
  Confirm the attribution ends up in the shared URL.

### 3.4 PostResolveShare (Sprint 4)

Files:
- `src/components/PostResolveShare.tsx`
- `src/screens/SignalerHomeScreen.tsx`
- `src/screens/RecipientHomeScreen.tsx`
- `src/screens/TrustedSupportScreen.tsx`

Verify:
- Role-aware copy: `signaler` = gratitude, `primary` = hero,
  `trusted` = bezpiecznik.
- All three screens wire `setSosResolvedVisible(true)` (or
  equivalent) only after the `resolve()` RPC succeeds, not on
  `catch` error path.
- `srcUserId` is now a prop (Sprint 9 refactor) — not a
  useRelationship call inside the component.
- Share variant fires correct analytics.inviteShared with
  `sos_resolved_{role}`.

### 3.5 Settings IA refactor (Sprint 5)

Files:
- `src/screens/SettingsScreen.tsx`
- `src/screens/CircleScreen.tsx`

Verify:
- One unified "Moi bliscy" card in Settings, no separate "Krąg
  bliskich" card.
- CircleScreen title is "Moi bliscy" (not "Twój krąg") — the
  nomenclature collision fix.
- Dead styles `safetyCard`, `safetyIcon`, etc. removed.
- `/trusted-support` title is now "Jesteś na wezwanie"
  (post-Sprint 9) — not "Krąg bliskich".

### 3.6 Multi-pair unblock (Sprint P2.1)

Files:
- `src/screens/AddPairScreen.tsx`
- `app/add-pair.tsx`
- `src/screens/SettingsScreen.tsx`

Verify:
- `AddPairScreen` is self-contained (name → code → share), does NOT
  import `SetupScreen` (the `mode` prop is removed post-Sprint 9).
- Inserts new `care_pairs` row with `caregiver_id = current user,
  senior_id = null, status = 'pending'`, 24h expiry, unique invite
  code.
- Settings CTA "Zaproś kolejną bliską osobę" renders only for
  `isRecipient && status === 'active'`.
- **Check for the known issue (P1-6)**: if the user backs out before
  copying the code, the pending row lingers in DB. Is there cleanup
  or does it just expire in 24h? Impact assessment.
- `useCircle` already fetches all active pairs (including multiple),
  but `RecipientHomeScreen` still uses `signalers[0]`. Confirm this
  doesn't break if user has 2+ signalers — which primary wins?

### 3.7 Deep-link attribution (Sprint 7)

Files:
- `src/utils/invite.ts` (new `buildJoinUrl`, `buildPeerShareUrl`)
- `app/join/[code].tsx`
- `app.config.ts`

Verify:
- All share sites (7 locations) now pass `srcUserId` to
  `buildJoinUrl` or `buildPeerShareUrl`. Check each:
  - `WaitingForConnectionScreen.handleShare` → `profile?.id`
  - `AddPairScreen.handleShare` → fetched from `supabase.auth.getUser()`
  - `TrustedContactsScreen.handleSendInvite` → builds its own URL
    directly (not via shareInvite), check it embeds the code
  - `TrustedSupportScreen.handleShareSenior/Family` → `profile?.id`
  - `RecipientHomeScreen.handlePeerRecommend` → `myUserId`
  - `CircleScreen.handleSharePeer` → `profile?.id`
  - `MilestoneCelebration.handleShare` → `srcUserId` prop
  - `PostResolveShare.handleShare` → `srcUserId` prop
- `/join/[code].tsx` fires PostHog `install_via_invite` with
  `source_user_id` read from `useLocalSearchParams` `src` param.
- `app.config.ts` has `ios.associatedDomains: ['applinks:cmok.app']`
  and `android.intentFilters` for `https://cmok.app/join/*`.
- **Known scope cut (P1-2):** peer share URL (`cmok.app/pobierz?src=&type=`)
  is NOT tracked in-app (only `/join/{code}` deep link is). Is the
  commit message honest about that?
- **Known infra blocker (P2-1):** Universal Links require AASA on
  `cmok.app`. Is there a TODO visible somewhere in the repo so this
  isn't forgotten for launch?

### 3.8 Home screen polish

Files:
- `src/screens/SignalerHomeScreen.tsx`
- `src/screens/RecipientHomeScreen.tsx`

Verify:
- After the gap fix (commit `34bccbc`), `s.center` no longer has
  `flex:1 + justifyContent:'center'`. Content flows top-to-bottom;
  SOS button sits at bottom via ScrollView's `space-between`.
- After the opacity fix (commit `3ea7cad`), status pills render as
  plain Views with opacity 1. Verify that after Sprint 9 cleanup,
  `moodPickedOpacity` and `moodPickedScale` no longer exist in the
  file.
- Signaler side: picked mood pill + "Darek zobaczy Twój znak"
  confirmation pill are both visible after a mood pick.
- Recipient side: `sub` no longer includes the check-in time when
  `effOk` (SafetyStatus shows it). Confirm `statusLabel` alone is the
  sub content in the OK case.

### 3.9 Performance optimisations (Sprint 10)

Files:
- `src/hooks/useAuthedUserId.ts` (new)
- `src/components/WeekDots.tsx`

Verify:
- `useAuthedUserId` uses `supabase.auth.getSession()` (cached) not
  `getUser()` (DB hit) and subscribes to `onAuthStateChange`.
- `WeekDots` is wrapped in `memo` with a custom element-wise comparator
  on `days: DayStatus[]`.
- Grep for remaining calls of `useRelationship` — are any of them
  purely for `profile.id` and still swappable to `useAuthedUserId`?
  Candidates: `CircleScreen`, `TrustedSupportScreen`.

### 3.10 E2E scaffolding (Sprint 11)

Files:
- `.maestro/*.yaml`
- `docs/E2E_TESTS.md`

Verify:
- All 7 flow files syntactically valid (run `maestro test
  --dry-run .maestro/` if Maestro is installed).
- Assertions map to actual visible copy/accessibility labels in the
  current screens.
- Hardcoded invite code `111222` in `onboarding-signaler.yaml` is
  documented as a placeholder (should be replaced per-run).

## Step 4: Run the actual tests

If Maestro is installed and a simulator is running cmok:

```bash
# Reset to a known state
curl -X POST https://pckpxspcecbvjprxmdja.supabase.co/functions/v1/reset-test-data \
  -H "Content-Type: application/json" \
  -d '{"mode": "keep_pair"}'

maestro test .maestro/checkin-flow.yaml
maestro test .maestro/recipient-reaction.yaml
maestro test .maestro/sos-flow.yaml
```

Flag any failures — copy mismatch between YAML and actual UI means
either my flows are wrong or the UI drifted.

## Step 5: Security / privacy check

Specifically review:

1. `buildJoinUrl(code, srcUserId)` embeds raw UUID in share text.
   Is this acceptable PII exposure? See `AUDIT_VIRAL_SPRINTS.md`
   P0-5 — I deferred a HMAC hash. Challenge me: is that the right
   call, or should we fix before launch?
2. `install_via_invite` PostHog event carries `source_user_id`.
   Does PostHog project privacy config retain UUIDs appropriately?
3. Milestone persistence keys in SecureStore:
   `cmok_recipient_last_milestone_seen_{sigId}` — does a
   malicious actor with device access learn anything useful from
   these? (Probably no — just a streak number.)

## Step 6: Bundle / perf real numbers

Not done in my audit. You should:

```bash
npx expo export --platform ios --output-dir dist
du -sh dist
```

Compare to previous build if available. The viral work added:
- 2 new components (MilestoneCelebration already existed; added
  PostResolveShare, AddPairScreen)
- 1 new hook (useAuthedUserId)
- No new native deps

Expected bundle delta: < 50 KB.

Also profile the signaler home with React DevTools — does the
WeekDots memo actually kick in, or does the parent still pass a new
`days` array reference every render?

## Step 7: Brand voice QA

Read every new copy string for:
- lowercase "cmok" — no capitalised "Cmok" or "CMOK"
- no em dashes in visible UI copy (only in doc / code comments OK)
- Polish diacritics correct (ą ę ć ś ź ż ó ł ń)
- "bliska osoba" not "użytkownik"
- warm register — nothing clinical/alarmist/technical

Specifically flag:
- New CTA labels in viral cards
- PostResolveShare copy (3 variants)
- Milestone copy (extended ladder)
- AddPairScreen copy
- `/trusted-support` new title "Jesteś na wezwanie" — too formal?
  Too impersonal? Suggest an alternative if it doesn't fit.

## Step 8: What I'd fix before build 26

Output a punch list in this format:

```
P0 (blocks ship):
  - [file:line] What, why

P1 (ship but track):
  - ...

P2 (follow-up):
  - ...
```

Don't be gentle. The point of the double-check is to catch what I
missed. My own findings in `AUDIT_VIRAL_SPRINTS.md` are one POV —
challenge them.

## Deliverable

Write your findings to `docs/CODEX_REVIEW_VIRAL_SPRINTS.md` and
commit. Include:

- your own P0/P1/P2 triage
- agreement/disagreement with each finding in my self-audit
- specific bugs I missed
- verdict: **ship build 26 now** / **fix P0 first** / **stop, broader issue**

Make it opinionated. We'll merge differences in a human review pass.
