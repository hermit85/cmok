# Codex Double-Check Audit Prompt for cmok

## Context
cmok is a React Native/Expo app (iOS + Android) that provides a daily check-in ritual between family members who live apart. One person ("signaler") taps once daily to say "I'm OK". Their circle ("recipients" + trusted contacts) sees the sign and can react.

Tech stack: React Native + Expo SDK 54, Supabase (PostgreSQL + Auth + Edge Functions + Realtime), expo-router.

## Your Task

You are doing a **verification audit** of the cmok app. A previous audit found 131 working interactive elements, 0 stubs, and 5 minor issues. Your job is to **double-check** this finding and catch anything that was missed.

### Step 1: Verify every route renders without crash

For each route in `app/`, confirm:
- The component imports exist and resolve
- Required hooks return the expected shape
- No TypeScript errors in the file
- No missing color/typography tokens that would cause runtime errors

Check these files:
```
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

### Step 2: Verify every RPC and Edge Function call

Find every `supabase.rpc()` and `supabase.functions.invoke()` call in the codebase. For each:
1. Confirm the RPC/function name exists in the Supabase project
2. Confirm the parameter names match what the DB expects
3. Confirm error handling exists (try/catch or .error check)
4. List any RPC that is called but might not exist

RPCs to verify: `accept_relationship_invite`, `add_trusted_contact_by_phone`, `remove_trusted_contact`, `claim_support_alert`, `resolve_support_alert`

Edge functions to verify: `checkin-notify`, `urgent-signal`, `nudge-signal`, `delete-account`, `register-device`

### Step 3: Verify data flow for both user types

**As Signaler (+48100000001, SMS code 123456):**
1. Login → should route to /signaler-home (if active pair) or /join (if no pair)
2. "Daj znak" circle tap → should create daily_checkins row + fire checkin-notify
3. Status mood selection → should update daily_checkins.status_emoji
4. Long press → should open UrgentConfirmation → send urgent signal
5. Settings → should show recipient name, editable own name, logout, delete
6. Circle screen → should show recipient info

**As Recipient (+48100000002, SMS code 123456):**
1. Login → should route to /recipient-home (if active pair) or /waiting (if pending)
2. See signaler's daily sign → status circle should update to OK
3. Reaction buttons → should insert into signals table
4. "Przypomnij delikatnie" → should call nudge-signal edge function
5. Settings → should show signaler name, invite card, circle count
6. TrustedContacts → should allow adding by phone, removing

### Step 4: Verify realtime subscriptions

Check that these realtime channels are properly subscribed and cleaned up:
1. `useSignals.ts` — signals table changes (INSERT filter by user_id)
2. `RecipientHomeScreen.tsx` — daily_checkins table changes
3. `useUrgentSignal.ts` — alert_cases + alert_deliveries changes

For each: confirm `supabase.channel()` has proper filter, `.subscribe()` is called, and cleanup returns `supabase.removeChannel()`.

### Step 5: Check for Polish language issues

The app must use correct Polish diacritics: ą, ę, ć, ś, ź, ż, ó, ł, ń.

Search ALL .tsx files for common mistakes:
- "z rzedu" should be "z rzędu"
- "lacznie" should be "łącznie"  
- "Caly" should be "Cały"
- "Swietna" should be "Świetna"
- "Potrzebuje" should be "Potrzebuję" (check if used correctly)
- "polaczeni" should be "połączeni"
- "Sprawdz" should be "Sprawdź"

### Step 6: Dead code identification

Confirm these files are NOT imported anywhere and can be safely deleted:
- `src/screens/LocationConsentScreen.tsx`
- `src/screens/PhoneAuthScreen.tsx`
- `src/screens/VerifyCodeScreen.tsx`

Search for any imports of these files across the entire codebase.

### Step 7: Security check

1. Confirm no API keys or secrets are hardcoded in source files (only in .env or supabase.ts config)
2. Confirm RLS is referenced (Row Level Security) — the app should rely on RLS, not client-side filtering
3. Confirm the `delete-account` flow properly calls a server-side function (not client-side deletion)
4. Confirm `auth.uid()` is used in all RPC functions for authorization

### Output Format

For each step, report:
- **PASS** — verified, works correctly
- **FAIL** — found an issue (describe it with file path and line number)
- **WARN** — potential concern but not blocking

End with a summary: total PASS/FAIL/WARN counts and a prioritized list of issues to fix before App Store submission.
