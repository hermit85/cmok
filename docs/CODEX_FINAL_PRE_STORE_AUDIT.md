# Codex Final Pre-Store Audit — cmok

## Context

cmok is an iOS (+ Android) app built with React Native + Expo SDK 54.
Polish-first, for a daily closeness ritual between people living apart.
Roles: `signaler` (gives a daily sign), `recipient` (receives + reacts),
`trusted` (safety network, SOS-only).

**This is the last audit before submitting to App Store review.** Build 27
is already in TestFlight processing. Don't trust my prior audits
(`docs/AUDIT_VIRAL_SPRINTS.md`, `docs/APP_STORE_SUBMISSION_CHECKLIST.md`,
`docs/CODEX_AUDIT_VIRAL_SPRINTS.md`, `docs/PRE_RELEASE_AUDIT.md`). Verify
independently from source.

Project path: `/Users/darekptaszek/Projects/cmok`.
Supabase: `pckpxspcecbvjprxmdja` (Frankfurt EU).
Commit range to review: full repo at HEAD (commit `eb8b992` or later).

## Brand rules (enforced — flag violations explicitly)

- `cmok` is always lowercase in visible copy, including `app.config.ts
  name` field, Info.plist, NSLocation/NSTracking permission copy
- No em-dashes (—) in UI text (comments OK)
- Correct Polish diacritics: ą, ę, ć, ś, ź, ż, ó, ł, ń
- "bliska osoba" instead of "użytkownik"
- "krąg bliskich" instead of "circle" / "network"
- Warm, not clinical

## Your task

Walk through everything an App Store reviewer (or worse — a user) could
trip on. Output a verdict + prioritised fix list, explicitly assigning
each item P0 (ship blocker), P1 (bug, track), or P2 (polish).

**Be opinionated. Disagree with my fixes if they're wrong.** Prior
self-audit fixed ~25 items; catch the 10 I missed.

---

## Step 1 — Product integrity

### 1.1 Role-based entry point routing

From `app/index.tsx` → `app/_layout.tsx` → home screens. For each of
signaler / recipient / trusted / none (fresh install), simulate:

- What does the app render on first open?
- Can a trusted-role user accidentally land on `/recipient-home` or
  `/signaler-home` because `useRelationship` returned a stale value?
- Does `status='pending'` correctly route to `/waiting`?
- Does `status='active'` correctly route home?
- On logout → `supabase.auth.signOut()` → where does the user land?
  Verify no flash of authed content.

### 1.2 Multi-pair safety net

`src/constants/featureFlags.ts` gates `MULTI_PAIR_ENABLED = false`.
Confirm:

- The "Zaproś kolejną bliską osobę" CTA in `SettingsScreen` is
  hidden behind the flag.
- The `/add-pair` route is still reachable via direct deep link.
  Is that acceptable? (Argument: internal QA can test; Apple reviewer
  won't stumble into it unless URL is in review notes.)
- If a caregiver already has a pending additional pair in DB (leftover
  from a prior build), `/waiting` should redirect on `status='active'`.
  That was the bug fix in commit `170c506`. Verify the fix is solid.

### 1.3 SOS flow

`SignalerHomeScreen` → "Potrzebuję pomocy" button → `UrgentConfirmation`
modal → `sendUrgentSignal` → alert_cases row + circle push notifications.

- The disclaimer must say "cmok nie zastępuje numeru 112". Search for
  it. If missing, P0.
- Offline path: `NetInfo.isConnected === false` — what happens if user
  hits SOS offline?
- Resolve path: `PostResolveShare` overlay must fire ONLY after
  `resolve()` succeeds, not on catch. Verify in all three screens
  (Signaler, Recipient, TrustedSupport).

### 1.4 Account deletion (GDPR)

`SettingsScreen.handleDeleteAccount` → invokes `delete-account` edge
function → deletes auth user + all related rows.

- Does the function correctly delete: users row, care_pairs,
  trusted_contacts, daily_checkins, signals, alert_cases,
  device_installations?
- Is there a confirmation step before deletion? Apple requires
  in-app account deletion for any app collecting user data (yes, we
  do).
- Landing page at `https://cmok.app/usun-konto` must also be reachable
  as a separate path (for users who can't open the app). Verify.

---

## Step 2 — App Store Review hot buttons

### 2.1 Export Compliance

`app.config.ts → ios.infoPlist.ITSAppUsesNonExemptEncryption = false`.
Added in commit `b842e4e`. Confirm it's in build 27. If absent,
Apple stalls the build in "Missing Compliance".

### 2.2 Privacy manifest

`ios/Cmok/PrivacyInfo.xcprivacy` — confirm these 8 types are declared
AND match what the app actually collects:

| Type | Used for | Linked | Tracking |
|------|----------|--------|----------|
| Name | users.name | yes | no |
| Phone | auth + users.phone | yes | no |
| User ID | Supabase UUID + analytics identity | yes | no |
| Precise Location | alert_cases.lat/lon (SOS only) | yes | no |
| Product Interaction | PostHog events | yes | no |
| Crash Data | Sentry | no | no |
| Performance Data | Sentry | no | no |
| Other Diagnostic Data | device_installations | yes | no |

- If any of these types isn't actually collected → Apple reject.
- If anything IS collected but not declared → reject on privacy
  inconsistency.
- Cross-check with PostHog event names in `src/services/analytics.ts`.

### 2.3 Permission copy (visible to user in OS prompts)

Search every `*UsageDescription` string. Confirm:

- `NSLocationWhenInUseUsageDescription` — starts lowercase "cmok"
- `userTrackingPermission` (from expo-tracking-transparency plugin) —
  lowercase "cmok"
- No English in Polish-first copy.

### 2.4 Push notifications

- `expo-notifications` is configured. Apple requires the app to
  request permission only when there's a reason. Verify the prompt
  triggers on a sensible screen (not on first launch).
- Alert content must not be misleading. Push copy in edge functions
  (`checkin-notify`, `nudge-signal`, `urgent-signal`, `poke-notify`,
  `reaction-notify`, `morning-reminder`, `missed-sign-alert`,
  `weekly-summary`) — read each body string. Any that say "Your
  message was ..." are technically advertising-style; reject-prone.

### 2.5 Age rating / content

- 4+ is declared. Confirm no user-to-user chat, no unrestricted web
  browsing (Linking.openURL() calls go to owned domains + mailto +
  tel: only).
- Profanity filter on name input: users can type any name as
  signaler_label. A user entering profanity would render in UI copy.
  Is that a problem? (Probably not blocking; flag as P2.)

### 2.6 Apple sign-in

Not implemented. We use SMS OTP. Apple guideline 4.8: apps using
third-party or social login MUST offer Sign in with Apple. SMS OTP
doesn't count as third-party. Confirm this reasoning holds — we're
not using Google/Facebook/Twitter login, just SMS.

---

## Step 3 — Runtime paths that break silently

### 3.1 Offline mode

App launches with no network. Verify:

- `useRelationship` retry logic triggers (3 attempts, 3s apart, then
  gives up).
- `useCircle` falls back to empty state.
- Home screens show sensible UI, not a frozen spinner forever.
- Sending a check-in while offline — is there a queue? If not, does
  the user see a "brak internetu" state?

### 3.2 Corrupted state

- User deletes their account on another device. Current device has
  cached session. What happens on next action? `useRelationship`
  should detect the 404 and redirect to `/onboarding`.
- Expired invite code (24h past `invite_expires_at`) — does
  `JoinScreen.redeemCode` show a readable error?
- Signaler deletes recipient → care_pair goes away → recipient sees
  `/onboarding`. Verify.

### 3.3 Analytics cardinality

`PostHog install_via_invite` event now carries `source_user_id`.
Review:

- Are user IDs (UUIDs) getting into high-cardinality PostHog
  properties? If so, PostHog project will age quickly.
- `milestone_shared` event has `variant` property with values like
  `milestone_recipient_30d`. Confirm the enumeration is bounded
  (should be: 7/14/21/30/50/100/365 × 2 perspectives = 14 distinct
  values).

---

## Step 4 — Code correctness

### 4.1 Hook rules

For every `useEffect` in `src/screens/*.tsx`:

- No conditional `useEffect` calls.
- No early return before hooks.
- All referenced variables in the dep array, or explicitly noted why
  not.
- Cleanup handlers present where setInterval / setTimeout /
  AppState.addEventListener / realtime channels are set up.

### 4.2 Race conditions

- `SecureStore.getItemAsync` + setTimeout pattern in
  RecipientHomeScreen line ~449 — verified in commit `eb8b992`.
  Confirm the `cancelled` check is inside the setTimeout.
- `supabase.channel('...').subscribe()` patterns — confirm cleanup
  via `removeChannel`.

### 4.3 useRelationship / useCircle dedupe

`src/utils/requestDedup.ts` wrapped both hooks in commit `482b068`.
Confirm:

- `dedupedFetch.invalidate()` is called in `auth.onAuthStateChange`.
- No memory leak from the module-level `pending` / `cache` maps
  (they're single-entry so bounded by definition).
- The 500ms TTL doesn't stale-cache across a manual refresh.
  `refreshRelationship` should call through to a fresh fetch.

### 4.4 Typescript strictness

```bash
npx tsc --noEmit
```

Should be 0 errors. If there are any, flag each.

### 4.5 Unused code / dead imports

Run mental pass on `src/screens/*.tsx` for:

- Imports that aren't used.
- State declared but never read.
- Style rules not referenced (post-Sprint 5, several `safetyCard` /
  `inviteCard` styles were removed — confirm no stragglers).

---

## Step 5 — Metrics readiness

App ships with PostHog events. Before release, verify:

- Every share path fires exactly one `invite_shared` event with the
  correct `type` value.
- No double-fire (the AddPairScreen `invite_shared` dupe was fixed
  in commit `1665a80`).
- `install_via_invite` fires on every `/join/{code}` deep link open,
  with `source_user_id` extracted from `?src=` query.
- Milestone events (`milestone_reached`, `milestone_shared`) include
  `perspective` (signaler / recipient).

---

## Step 6 — Infrastructure that affects ship quality

### 6.1 Edge functions

12 must be ACTIVE. Listed in the CLAUDE.md. Verify via MCP or
Supabase dashboard.

### 6.2 pg_cron

4 jobs must exist + active:
- `checkin-monitor` — every 30 min
- `morning-reminder` — 0 7 * * * (CEST 9:00)
- `missed-sign-alert` — 0 18 * * * (CEST 20:00)
- `weekly-summary` — 0 16 * * 0 (Sunday CEST 18:00)

### 6.3 RLS

All 8 tables RLS-enabled. Run `get_advisors(type: 'security')` via MCP
and review lints. Fix anything at level ERROR. WARN is acceptable
deferral.

### 6.4 Landing page endpoints (cmok.app)

- `/polityka-prywatnosci` → 200
- `/regulamin` → 200
- `/usun-konto` → 200
- `/pobierz` → 307 redirect (normal)
- `/.well-known/apple-app-site-association` → **currently 404**
  (Universal Links disabled in build 27 via
  `associatedDomains` commented out in app.config.ts). This is
  acknowledged; not a ship blocker.
- `/.well-known/assetlinks.json` → **currently 404** (same story
  for Android).

---

## Step 7 — What to output

Your deliverable lives at
`docs/CODEX_REVIEW_FINAL_PRE_STORE.md`. Include:

1. **Verdict**: SHIP / FIX P0 FIRST / STOP (something fundamental is
   off). Be willing to say STOP.
2. **P0 fix list** with file:line and proposed change.
3. **P1 fix list** for post-TestFlight-beta.
4. **P2 list** for v1.1.
5. **Things my self-audit got wrong** — agent hallucinations, stale
   assumptions, fixes that didn't actually fix what they claimed.
6. **Apple reviewer red flags specific to cmok** — parts of the app
   that look weird without the cultural context (Polish-first, SMS
   OTP, lowercase brand, SOS disclaimer).

Don't pad. One line per finding is enough if it's clear.
