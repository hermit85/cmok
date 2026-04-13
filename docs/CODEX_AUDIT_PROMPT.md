# Codex Double-Check Audit Prompt for cmok

## Context
cmok is a React Native + Expo app for a daily closeness ritual between people who live apart.

Two main roles:
- `signaler`: gives one daily sign, "daj znak"
- `recipient`: receives the sign and can react

Tech stack:
- React Native + Expo SDK 54
- expo-router
- Supabase Auth, Postgres, Realtime, Edge Functions

Project path:
- `/Users/darekptaszek/Projects/cmok`

Current local context:
- date: `2026-04-13`
- timezone: `Europe/Warsaw`

Test accounts:
- recipient: `+48100000002`, app input `100000002`
- signaler: `+48100000001`, app input `100000001`
- OTP for both: `123456`

Important brand rules:
- lowercase `cmok`
- warm Polish copy
- no em dashes in UI copy, use commas instead
- correct Polish diacritics are required

## Your Task

Do a fully independent verification audit of `cmok`.

Do not trust previous reports.
Do not assume a screen is real just because it renders.
Do not assume a bug is in UI if it may come from backend state.

Your job is to separate:
1. what is real and backed by live data,
2. what is preview-only or dev-only,
3. what is blocked by current backend data state,
4. what is actually broken.

## Step 1: Verify current backend state first

Before judging the app flow, inspect the current Supabase data for both test accounts.

You must verify:
- whether the signaler-recipient pair is already `active`,
- whether there are extra `pending` rows in `care_pairs`,
- what `invite_code` currently exists,
- whether `signaler_label` and `senior_name` survive invite acceptance,
- whether current DB state explains any onboarding shortcut or skipped screen.

Be explicit about dates and statuses.

## Step 2: Audit every route

Check every route in `app/`:

```text
app/_layout.tsx
app/index.tsx
app/onboarding.tsx
app/signaler-home.tsx
app/recipient-home.tsx
app/settings.tsx
app/circle.tsx
app/trusted-contacts.tsx
app/waiting.tsx
app/trusted-support.tsx
app/join/[code].tsx
```

For each route, answer:
- does it render without crash,
- does it use real hooks and real data,
- is it reachable through real flow,
- is it only reachable by dev preview params,
- is it a real screen, a preview state, or an unverified screen.

## Step 3: Test real flows for both roles

### As recipient
Using `+48100000002` and OTP `123456`, verify:
- login behavior,
- route resolution from `/`,
- `recipient-home`,
- reaction buttons,
- settings,
- circle,
- trusted contacts,
- waiting screen if current data state allows it,
- support-related surfaces if current data state allows them.

### As signaler
Using `+48100000001` and OTP `123456`, verify:
- login behavior,
- route resolution from `/`,
- onboarding path `Mam kod zaproszenia`,
- whether join code step appears or is skipped,
- `signaler-home`,
- `daj znak`,
- status mood update,
- settings,
- circle,
- urgent flow entry surface.

Important:
- if a step is skipped, determine whether it is because of a bug or because current DB state already satisfies a later condition.

## Step 4: Identify preview-only behavior

Inspect all preview logic and list every screen state that is not production-backed.

Focus on:
- `app/signaler-home.tsx`
- `app/recipient-home.tsx`
- preview parsing helpers
- `__DEV__` gated behavior

For each preview state, explain:
- how it is triggered,
- whether it changes real data,
- whether it could be confused with a production flow during QA.

## Step 5: Verify Supabase integrations

Find every:
- `supabase.rpc(...)`
- `supabase.functions.invoke(...)`
- direct REST-like Supabase data writes
- realtime subscription

For each integration, verify:
- existence,
- parameter names,
- error handling,
- whether cleanup is present for subscriptions,
- whether the call is essential, optional, or risky.

Pay special attention to:
- `accept_relationship_invite`
- `add_trusted_contact_by_phone`
- `remove_trusted_contact`
- `claim_support_alert`
- `resolve_support_alert`
- `checkin-notify`
- `urgent-signal`
- `nudge-signal`
- `delete-account`
- `register-device`

## Step 6: Check for data-model inconsistencies

Treat this as a real product audit, not just a UI pass.

Specifically investigate whether:
- an `active` and `pending` relationship can coexist for the same recipient,
- `SetupScreen` can create new pending invites while an active relation already exists,
- relation labels degrade to generic copy like `Bliska osoba`,
- the app loses personalized names after invite acceptance,
- route resolution in `app/index.tsx` behaves incorrectly when multiple relationship rows exist.

## Step 7: Brand and copy audit

Audit visible UI copy against the cmok rules.

Check for:
- em dashes in UI text,
- wrong tone,
- generic technical wording,
- missing Polish diacritics,
- inconsistent naming of roles and relationships,
- lowercasing of `cmok`.

Search all `.tsx` files for:
- `—`
- common missing diacritics
- phrases that sound technical or cold

## Step 8: Safety and destructive actions

Do not perform destructive actions unless absolutely required.

Do not:
- delete accounts,
- trigger real urgent alerts if they notify real people,
- mutate production-like data unnecessarily.

If something is not safe to test live, mark it as:
- `not safely verified`

## Output format

Return the audit in this order:

### 1. Findings
List the issues first, ordered by severity.

For each finding include:
- severity: `blocker`, `major`, or `minor`
- exact problem
- whether it is a `data bug`, `UI bug`, `flow bug`, `copy bug`, or `preview-only behavior`
- reproduction steps
- file path and line number when applicable

### 2. Verified Real Screens
List screens and flows you confirmed are truly backed by live logic or live data.

### 3. Preview-Only Screens or States
List all screens or states that are only available through dev preview logic.

### 4. Not Fully Verified
List anything you could not safely or conclusively verify.

### 5. Summary
End with:
- total count of `blocker`, `major`, and `minor`
- whether the app looks ready for App Store review
- the top 3 issues to fix first

## Important quality bar

Do not give a shallow route listing.
Do not just say "works" because a screen appeared.
Explain whether each behavior is:
- really live,
- preview-only,
- or explained by current backend state.
