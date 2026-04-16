# Codex Double-Check Audit — Build 17 (pre-submission)

## Context
cmok is a React Native + Expo app for a daily closeness ritual between people who live apart.

Two main roles:
- `signaler` — gives one daily sign "daj znak" (elderly person, e.g. Mama)
- `recipient` — receives the sign and can react (caregiver, e.g. Darek)
- Trusted contacts: people in signaler's safety circle who get SOS alerts

Tech stack: React Native + Expo SDK 54, expo-router, Supabase Auth/Postgres/Realtime/Edge Functions

Project path: `/Users/darekptaszek/Projects/cmok`
Current date: `2026-04-16`
Timezone: `Europe/Warsaw`
Build: pre-Build 17 audit (20 commits since Build 16 / 042e2d4)

## Test accounts
- signaler: `+48100000001`, OTP `123456`, name "Mama"
- recipient: `+48100000002`, OTP `123456`, name "Darek"
- trusted contact: `+48100000003`, OTP `123456`, name "Sąsiad" (NOT in Supabase test OTP whitelist — only works for 001/002)

## Your Task

Do a fully independent verification audit. Don't trust previous reports. Separate:
1. What is real and backed by live data
2. What is preview-only or dev-only
3. What is blocked by current backend state
4. What is actually broken

## Step 1: Verify current backend state

Before judging the app flow, inspect Supabase data for test accounts:
- What's the current state of `care_pairs`? (active/pending counts, invite codes)
- What's the `users.name` for 001, 002, 003? (should be Mama, Darek, Sąsiad)
- Any orphaned pending pairs?
- Today's `daily_checkins` for Mama?
- Any open `alert_cases`?

Be explicit about what you find live.

## Step 2: Audit Build 17 changes (20 commits since 042e2d4)

### Major refactors to verify:

**2a. Signaler home simplification**
- Poke section removed entirely (no "Wyślij gest" before or after check-in)
- STATUS_MOODS has 4 entries (Dobrze, Spokojnie, Zmęczona, U lekarza) — NOT 5
- Post-check-in mood pick shows "[Name] zobaczy" hint via `statusSentHint` style
- Stats row only when currentStreak >= 3 (not on first check-in)
- "Jutro Ci przypomnimy" hidden when isReallyFirstEver (dbTotalCount === 0)
- "Dodaj kogoś do kręgu bliskich" link after stats (teal, goes to /trusted-contacts)
- Header subtitle uses `dla ${rf.genitive}` (e.g. "dla Darka")
- handleStatusPick still sends poke signal to recipient (for push notification)

**2b. Recipient home simplification**
- Nudge button "Przypomnij delikatnie" REMOVED
- MonthGrid component REMOVED from recipient (no "Pokaż więcej")
- "Powiedz komuś o cmok" viral link REMOVED
- Poke section only when !effOk (before check-in)
- Incoming poke pill rendered above ResponseTap (in actions section)
- Title simplified: "Jest znak" / "Pierwszy znak!" (no "od [name]" which was duplicated in header)
- ResponseTap moved above the rhythm section (WeekDots + MonthGrid removed) — primary action above fold

**2c. Circle screen — new visual design**
- `src/screens/CircleScreen.tsx`
- YOU avatar in center (coral, 72px, shows profile.name)
- Vertical 32px teal connection line
- "CODZIENNY ZNAK" uppercase label (small caps, letterSpacing)
- Main person avatar (56px) + role + active dot (green)
- Trusted circle: horizontal grid of 52px avatars + "Dodaj" dashed circle
- Peer recommendation card at bottom (surfaceWarm, "Znasz kogoś kto mieszka sam?")
- Works for both signaler and recipient (canManage was already fixed)

**2d. Trusted contacts redesign**
- `src/screens/TrustedContactsScreen.tsx`
- Phone input matches onboarding: `+48` prefix as label, 9-digit input with space formatting
- Success toast after add ("[Name] dodany(a) do kręgu ✓")
- Inline invite card when phone not in cmok (not just Alert)
- Avatar with initial in contact list
- Delete with Alert confirmation (was silent)
- canManage allows both signaler AND recipient (not just recipient)

**2e. SOS redesign + fixes**
- `src/components/UrgentConfirmation.tsx`: hero icon (💚), info cards with icons (🔔📍🤝), separated disclaimer
- `src/hooks/useUrgentSignal.ts`: session refresh before edge function call, 401 detection via FunctionsHttpError context.status
- "Już jest dobrze" button on SOS screen shows Alert on error (was silent catch)

**2f. Settings circle logic**
- `src/screens/SettingsScreen.tsx`
- Removed "Zaproś kolejną osobę" — replaced with "Twój krąg bliskich" card → /trusted-contacts
- Removed unused handlers (handleGenerateInvite, handleCopyInviteCode, handleShareInviteCode)
- Removed unused imports (Share, Platform, Clipboard, shareInvite)

**2g. Polish declension improvements**
- `src/utils/relationCopy.ts`
- New logic for masculine names ending in -ek: Darek→Darka, Tomek→Tomka
- General masculine consonant-ending logic (adds -a, -owi, -em)
- Test: getRelationForms("Darek").genitive should return "Darka"

**2h. Database migrations**
- Migration 010: `add_trusted_contact_by_phone` uses `cp.`/`u.` aliases
- Migration 013: `resolve_support_alert` uses `ac.` alias, allows signaler OR acknowledged_by
- Migration 014: `add_trusted_contact_by_phone` output columns prefixed `out_`, uses named constraint for ON CONFLICT
- No other RPC with RETURNS TABLE(...) should have ambiguous column name collisions

**2i. Test data edge function**
- `supabase/functions/reset-test-data/index.ts`
- 5 modes: keep_pair, full_reset, seed_sasiad, seed_invite, seed_apple_review
- seed_apple_review creates active pair + today's check-in from Mama
- seed_invite creates pending pair with code 111222 for Darek
- seed_sasiad creates auth + profile for 003

## Step 3: Verify preview/dev-only behavior

Check for:
- `__DEV__` gated behavior in home screens
- Preview modes (before/after/response/support) that might confuse QA

## Step 4: Check for regressions

Things that should STILL work:
- Daily check-in flow (signaler taps Daj znak → DB insert → push to recipient)
- Reaction flow (recipient taps ♥ → signals insert → reaction-notify push)
- SOS flow (signaler taps SOS → confirmation → edge function → alert_cases + deliveries)
- Onboarding (login → OTP → role pick → name → setup/join)
- Join by invite code (recipient creates code → signaler enters → active pair)

## Step 5: Brand and copy

- Lowercase `cmok` everywhere
- No em dashes `—` in UI text (use commas)
- Polish diacritics correct
- No "użytkownik" / "check in" / "circle" / "network"
- Warm tone, not clinical

Search for these patterns.

## Step 6: Verify edge function deployment

Make OPTIONS calls to verify all 12 edge functions are deployed:
- checkin-notify, checkin-monitor, urgent-signal, nudge-signal, morning-reminder
- weekly-summary, missed-sign-alert, delete-account, register-device
- reaction-notify, poke-notify, reset-test-data

## Step 7: Safety

Do not:
- Delete accounts (they're live test data)
- Trigger real SOS alerts unnecessarily
- Mutate production-like data

If something cannot be verified safely, mark `not safely verified`.

## Output Format

### 1. Findings (ordered by severity)
For each: severity (blocker/major/minor), exact problem, type (data bug/UI bug/flow bug/copy bug/preview-only), reproduction steps, file path + line number.

### 2. Verified Real Screens
Confirmed live-backed flows.

### 3. Preview-Only Screens or States
Dev-only behaviors to be aware of during QA.

### 4. Not Fully Verified
What couldn't be safely tested.

### 5. Summary
- Blocker/major/minor counts
- App Store readiness verdict
- Top 3 issues to fix first

## Quality bar
Don't just say "works" because a screen appeared. Explain whether each behavior is:
- really live
- preview-only
- or explained by current backend state
