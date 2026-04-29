# Codex Cross-Check — Android Setup

## Context

cmok is React Native + Expo SDK 54, already shipped to App Store
(`com.hermit85.cmok`, build 31). I just brought it to **Android-ready**
state on a new local toolchain and dry-ran E2E tests on an Android
emulator. **iOS is still in production and must not regress.** Don't
trust this report — verify independently from source.

Project path: `/Users/darekptaszek/Dev/active/cmok`
Supabase project: `pckpxspcecbvjprxmdja` (Frankfurt EU)
Firebase project: `cmok-9bd2a` (newly created today, Android only)
Date: `2026-04-29`. Branch: `main`, working-tree dirty (changes below).

Test accounts (live production DB):
- signaler: `+48 500 000 001` (Mama), OTP `123456`
- recipient: `+48 500 000 002` (Darek), OTP `123456`
- trusted: `+48 500 000 003` (Sąsiad), OTP `123456`

## What I changed

### Modified files

1. **`app/_layout.tsx`** — added opt-in `LogBox.ignoreAllLogs(true)` gated
   by `__DEV__ && process.env.EXPO_PUBLIC_DISABLE_LOGBOX === '1'`. Reason:
   the dev LogBox toast was overlaying the bottom SOS button on Android
   and intercepting Maestro taps. **Verify**: production builds unaffected
   (`__DEV__` is false), default dev experience unchanged when env unset.

2. **`scripts/android-emulator-start.sh`** — replaced two `rg` calls with
   `grep -q`. Reason: `ripgrep` not installed on this Mac. **Verify**: no
   regression in detection logic for already-running emulator or existing
   AVD.

3. **`.gitignore`** — added `google-services.json` so the Firebase config
   isn't committed. **Verify**: file is *not* tracked (`git ls-files |
   grep google-services` should be empty), and no Android build references
   it from a tracked path that breaks CI.

4. **`.env.local`** — appended `EXPO_PUBLIC_DISABLE_LOGBOX=1`. Local-only.
   `.env.local` is already gitignored.

### New files

5. **`google-services.json`** (gitignored) — Firebase config for
   `com.hermit85.cmok`, project `cmok-9bd2a`. Picked up by
   `app.config.ts` via existing conditional `googleServicesFile` block.
   **Verify**: package_name in JSON matches `app.config.ts`
   `android.package`. Verify the Firebase project is freshly created and
   not tied to any unintended GCP project.

6. **`.maestro/signaler-login-checkin.yaml`** — login flow for Mama, lands
   on signaler home, asserts core elements visible (idempotent — works
   pre- or post-checkin). **Verify**: assertions are stable, no Polish-
   diacritic regex pitfalls.

7. **`.maestro/signaler-sos.yaml`** — login + tap "Potrzebuję pomocy" +
   confirm modal. **Risk**: this triggers a real `urgent_signal` row in
   prod DB and a push to Darek's last-registered token. Verify the
   blast radius is acceptable for a recurring E2E test.

8. **`.maestro/signaler-invite-trusted.yaml`** — login + tap "Dodaj kogoś
   do kręgu bliskich" → input phone `600100299` (non-existent) → asserts
   pending invite + 6-digit code. **Risk**: leaves a pending
   `trusted_contacts` row keyed on `+48600100299`. Confirm this is OK.

### Untouched but worth checking

- `app.config.ts` — already had `android` section before my work. I did
  **not** modify this file, but verify the Android section is sane (package,
  versionCode, adaptiveIcon, permissions, conditional `googleServicesFile`).
- `eas.json` — already had `android-*` profiles. Verify they don't shadow
  or conflict with `ios-*` profiles.
- `ios/` directory — gitignored, regenerated via prebuild on demand. I did
  not run `expo prebuild --platform ios` so iOS native folder is untouched
  in this branch.
- `android/` directory — also gitignored, fully regenerated via
  `npx expo prebuild --platform android` to wire `google-services.json` in.

## What I tested on Android

- `npm run android:doctor` ✅
- `npm run android:emu:start` ✅ (after `rg` → `grep` fix)
- `npm run android:build:debug` ✅ (47 min first build — Maven cold cache)
- `adb install` + launch ✅ (cmok renders, brand system 1:1 with iOS)
- Maestro flow `signaler-login-checkin` ✅ — 10/10 steps green
- Maestro flow `signaler-sos` 🟡 — blocked at "Wyślij kod" by Supabase
  Auth rate limit on test phone (>5 attempts in 1h)
- Maestro flow `signaler-invite-trusted` 🟡 — same rate-limit blocker

## What I did not test

- Real push notifications on Android (emulator has no Google Play Services
  FCM by default; `registerPushToken()` skips non-physical devices anyway)
- Production AAB build via EAS (`build:android:production` not run yet)
- First Play Console upload (still manual, not done)
- iOS on this branch (no source changes that should affect iOS, but I
  haven't rebuilt iOS to confirm)

## Specific concerns I want you to verify

### A. iOS regression risk

The whole point was "Android without breaking iOS." Audit:

1. Does `app/_layout.tsx` LogBox change have any path that runs in
   production iOS? It's gated by `__DEV__ && EXPO_PUBLIC_DISABLE_LOGBOX === '1'`.
   Confirm `__DEV__` resolves false in iOS production bundles.
2. Re-running `npx expo prebuild --platform android` does not touch
   `ios/` — confirm by inspecting prebuild source, or by simulating it
   in a worktree.
3. EAS profiles: `ios-production` and `ios-preview` profiles are not
   modified. Submit profile `production` (used by `submit:ios:production`)
   is intact (still points to App Store Connect with the right ascAppId,
   appleTeamId).
4. `app.config.ts` `ios.buildNumber: '31'` is preserved (latest TestFlight
   build), `ios.bundleIdentifier`, `ios.infoPlist` unchanged.
5. `package.json` scripts for iOS unchanged.

### B. Secrets / privacy

1. `google-services.json` contains a Firebase API key. It's gitignored,
   but a fresh `eas build --platform android --profile android-production`
   needs the file accessible. Currently `app.config.ts` reads it from
   `process.env.GOOGLE_SERVICES_JSON || './google-services.json'` — for
   EAS cloud builds, the right pattern is upload-as-file-secret (not
   commit). Recommend the exact `eas` CLI commands.
2. Confirm no other secrets (Supabase keys, Sentry DSN, RESET_TEST_SECRET)
   leaked into committed files. Check `.env.local` is still in `.gitignore`
   (it is, line 46).
3. The Firebase project `cmok-9bd2a` is newly created. Verify it's
   isolated from any other GCP project, has appropriate billing/quotas
   set, and the API key has restrictions (Android app `com.hermit85.cmok`
   only — not "any HTTP referrer").

### C. Maestro flows correctness

1. `signaler-sos.yaml` triggers a real urgent signal on prod. Should this
   instead reset DB before/after via the `reset-test-data` edge function?
   Or should it be marked as "manual-only" and excluded from `npm run
   test:e2e`?
2. `signaler-invite-trusted.yaml` creates a pending `trusted_contacts` row
   keyed on `+48600100299`. After many runs, the DB will have a pile of
   pending invites. Recommend cleanup strategy.
3. Polish diacritics in regex — `text: "Twój znak"` failed earlier
   (suspect `ó` codepoint mismatch). Some flows still use diacritic
   regex. Recommend safer assertion pattern (substring without
   diacritics where possible).
4. Are there any race conditions in the existing flows
   (`onboarding-recipient.yaml` etc.) that could cause flakes on
   slower Android emulators?

### D. Build / packaging

1. After `expo prebuild --platform android`, the generated
   `android/app/build.gradle` should apply
   `com.google.gms.google-services` plugin and the project-level
   `android/build.gradle` should declare it. Confirm both.
2. Sentry plugin — `android/sentry.properties` regenerates on prebuild.
   Confirm credentials there match the iOS-side ones (or are correctly
   distinct per-platform).
3. `versionCode: 1` is the initial value. For Play Console, every uploaded
   AAB needs a unique monotonically increasing versionCode. Recommend
   bumping policy (mirror the iOS `buildNumber` approach).

### E. Out of scope (not for this audit)

- Maestro flow refactoring beyond what I added today
- Backend / edge function correctness
- Apple-side TestFlight / App Store submission state
- Any new feature work

## What I'd like back

A short report:
- ✅ / ❌ for each numbered concern in A–D
- Any **new** risks I missed (especially: ways the Android setup could
  break iOS at the next iOS release, or ways my LogBox change could
  affect production)
- Specific commands to run (e.g. `eas credentials` arguments) to upload
  google-services.json + FCM service account, with placeholders for
  actual values
- Recommended commit-splitting if I should land this in multiple PRs
  (e.g. tooling vs. test infra vs. config)

Trust nothing in this doc — verify against the working tree at HEAD.
