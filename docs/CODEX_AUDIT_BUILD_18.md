# Codex Double-Check Audit — Pre-Build 18

## Context
cmok is a React Native + Expo app for a daily closeness ritual.

Roles:
- `signaler` (e.g. Mama) — gives daily sign, builds safety circle, can SOS
- `recipient` (e.g. Darek) — receives sign, reacts, primary watcher
- `trusted contact` (e.g. Sąsiad) — gets SOS alerts, no daily access

Project: `/Users/darekptaszek/Projects/cmok`
Date: `2026-04-16`
Build: pre-Build 18 audit

Test accounts:
- `+48 100 000 001` (Mama, signaler) — OTP `123456`
- `+48 100 000 002` (Darek, recipient) — OTP `123456`
- `+48 100 000 003` (Sąsiad, trusted) — OTP `123456` (NOT in Supabase OTP whitelist, only test-able with seed)

## Build 17 → Build 18 changes (since b92bac4)

### Critical fixes
1. **claim_support_alert ambiguous state** (migration 015)
2. **nudge-signal timezone bug** (migration 016 — has_nudge_today RPC using warsaw_date)
3. **Drop legacy prototype tables** (migration 017 — cmoks/families/members)
4. **add_trusted_contact_by_phone ambiguous relationship_id** (migration 014)

### RODO compliance
5. **get_trusted_circle RPC** (migration 018) — masks phone for non-pair-owners and non-adders
6. **get_alert_participants RPC** (migration 018) — same for SOS view
7. **Documentation migration** (019 — RLS kept broad, privacy in app layer via RPCs)

### UX / UI polish
8. Settings cards: teal main relation + warm safety circle (no more 2x "krąg")
9. TrustedContacts: hero banner with count when circle non-empty
10. Recipient: streak feedback after sending reaction ("X dni z rzędu")
11. SOS: callEdgeFunction does fresh getUser() check, force signOut on 401
12. NO_AUTH alert redirects to /onboarding instead of stuck
13. Dead code cleanup (handleMilestoneShare, restartBreatheLoop, orphaned styles)

### Edge functions
14. nudge-signal v6 (Warsaw tz)
15. checkin-notify redeployed (verify_jwt consistency)
16. poke-notify v3 (removed walk emoji)

## Your Task

Independent verification. Don't trust previous reports. Test live where safe.

### Step 1: Backend state
Inspect Supabase live:
- Test users state (names, roles)
- care_pairs (active count, any pending)
- trusted_contacts (orphans?)
- Any open alert_cases?
- All migrations 001-019 applied?

### Step 2: RODO verification — CRITICAL
**Test live:** Log in as a trusted contact (or simulate). Try to query:
```
SELECT id, name, phone FROM users WHERE id IN (other-trusted-contact-ids)
```
- Does direct table SELECT still leak phone numbers? (RLS is intentionally broad)
- Does the get_trusted_circle RPC properly mask for non-managers?
- Does the app UI use ONLY the RPC, not direct table?

**Specifically check `useUrgentSignal.ts`** — it still does direct `select id, name, phone from users`. This IS a privacy leak in the SOS screen for trusted contacts. Flag as BLOCKER if confirmed.

### Step 3: Verify Build 18 fixes
For each commit since `b92bac4`:
- File path + line numbers
- Did the fix actually land?
- Any regressions?

### Step 4: SOS auth flow
- Logout, then trigger SOS
- Should redirect to /onboarding cleanly
- Check that callEdgeFunction in useUrgentSignal does fresh getUser()
- Verify retry/cancel/resolve also handle 401 (or note as TODO)

### Step 5: Trusted contacts flow
- Add a contact (cmok user) → success toast with real name
- Add non-cmok → invite card
- Remove → confirmation Alert
- Verify Usuń button only shows for pair owners + adder (per RODO)
- Phone displays as "+48 *** *** ***" when masked

### Step 6: Settings polish
- Verify 2 distinct cards (teal + warm), no duplicate "krąg" in title
- Account, Legal sections intact

### Step 7: Brand/copy
Search for em dashes, "użytkownik", capital "Cmok", missing diacritics

### Step 8: Edge function deployment
OPTIONS check all 12 functions

## Output Format
1. **Findings** — severity (blocker/major/minor), file/line, reproduction
2. **Verified working**
3. **Privacy leaks** — explicit RODO check results
4. **Not verified** (skipped for safety)
5. **Summary** — counts + App Store readiness

Quality bar: don't say "works" because a screen rendered. Verify against live data and code.
