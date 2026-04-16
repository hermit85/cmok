# cmok — Session Handoff

Read this first when starting a new session. Also read `CLAUDE.md` for full project context.

## Where we are
- **Current build:** 16 (on TestFlight, waiting for review)
- **Latest commit:** see `git log --oneline -5`
- **Backend:** Supabase project `pckpxspcecbvjprxmdja` (cmok)
- **TypeScript:** clean (`npx tsc --noEmit`)

## Test accounts
- Signaler (Mama): `+48 100 000 001`, OTP `123456`
- Recipient (Darek): `+48 100 000 002`, OTP `123456`
- Trusted contact (Sąsiad): `+48 100 000 003`, OTP `123456`
  - Used for testing trusted circle. Added via TrustedContacts screen.

## Reset test data before testing

**Between tests (keep pair, clean data):**
```bash
curl -X POST https://pckpxspcecbvjprxmdja.supabase.co/functions/v1/reset-test-data \
  -H "Content-Type: application/json" -d '{"mode":"keep_pair"}'
```

**Full reset (test onboarding from scratch):**
```bash
curl -X POST https://pckpxspcecbvjprxmdja.supabase.co/functions/v1/reset-test-data \
  -H "Content-Type: application/json" -d '{"mode":"full_reset"}'
```

## What was done in the last session (Build 14 → 16)

### Features added
- **Poke signals** (`signals.type = 'poke'`) — 1/day/person with push notification
- **Reaction push** — new `reaction-notify` edge function, recipient → signaler
- **SOS resolve button** — "Już jest dobrze" allows signaler to close own alert
- **Circle prompt** — one-time modal on recipient after first sign (< 2 trusted contacts)
- **Daily closure copy** — "Gotowe na dziś. Jutro Ci przypomnimy." (hidden on first-ever)
- **Signaler builds trusted circle** — both roles can now add/remove trusted contacts

### Bugs fixed
- WhatsApp share: removed `cmok://` deep link (was breaking message)
- Status mood persistence (signaler sees their pick after navigation)
- `handleStatusPick` uses `todayDateKey()` not UTC
- `add_trusted_contact_by_phone` RPC — ambiguous `status` column qualified
- `resolve_support_alert` RPC — same ambiguous `state` bug + allows signaler
- Nudge signal now persists row in `signals` table (was push-only)
- Nudge dedup uses Europe/Warsaw local day
- SOS trusted routing uses real schema (alert_cases → care_pairs → trusted_contacts)
- SOS push priority normal → high
- Pending invite guards (both `invite.ts` AND `SettingsScreen.tsx`)
- Graceful redirect on deleted relationship
- Register-device now guarded on valid session (no 401 spam)

### UX polish
- Removed "Zaproś kolejną osobę" from signaler Settings → "Twój krąg bliskich"
- Removed "Powiedz komuś o cmok" from recipient (useless)
- Removed "Zaproś kogoś do kręgu" viral link from signaler home
- Removed poke section from signaler (was confusing with mood chips)
- After check-in mood pick: shows "[Name] zobaczy" feedback hint
- Mood chips: 4 statuses instead of 5 (Dobrze, Spokojnie, Zmęczona, U lekarza)
- Stats row hidden until streak ≥ 3 (1/1 on day 1 is noise)
- Tighter vertical spacing on signaler after check-in
- ResponseTap moved above MonthGrid on recipient (was below fold)
- Title "Znak od Mamy" → "Jest znak" (header already says "od Mamy")
- Poke pill on signaler uses coral (not teal) — distinct from reaction receipt
- Em dash removed from all UI copy
- Chip style parity: shadows, 28px emoji, 14px gap, 66px width both screens

### Edge functions deployed
- `reaction-notify` (new) — push for reactions
- `poke-notify` (new) — push for pokes
- `reset-test-data` (new, no JWT) — test data cleanup
- `nudge-signal` v5 — persists signal row + Warsaw timezone dedup
- `urgent-signal` v4 — push priority high

### Migrations applied
- `010_fix_trusted_contact_rpc` — qualified status column
- `011_add_poke_signal_type` — poke type + index
- `012_poke_dedup_constraint` — unique index per Warsaw day
- `013_fix_resolve_alert_for_signaler` — qualified state column, allows signaler

## Known issues / watchouts

1. **Push token registration on simulator** — `Device.isDevice` returns false, so push tokens never register on simulator. Testing push requires real device via TestFlight.

2. **Emoji rendering on simulator** — emoji show as "?" on dev simulator, work fine on real device. Known RN simulator issue, not a bug in our code.

3. **Test accounts on same device** — push tokens are device-scoped. If you log in as signaler then switch to recipient on the same phone, only the latest user has a token. Need two physical devices to test push in both directions.

4. **Performance issues to watch** (from earlier audit, not fixed):
   - `useCircle`, `useSignals` fire sequential queries — could be parallelized
   - Urgent realtime channels have no filter — any `alert_cases` change globally triggers reload
   - `breatheShadow` animation uses `useNativeDriver: false` (JS thread)

## Building and submitting

```bash
# Bump build number in app.config.ts first
# ios.buildNumber: '16' → '17'

eas build --platform ios --profile production --auto-submit

# If auto-submit fails:
eas submit --platform ios --latest
```

## File map (most edited)

- `src/screens/SignalerHomeScreen.tsx` — main signaler home, 900+ lines
- `src/screens/RecipientHomeScreen.tsx` — main recipient home
- `src/screens/SettingsScreen.tsx` — settings, circle access
- `src/screens/TrustedContactsScreen.tsx` — manage trusted circle
- `src/hooks/useSignals.ts` — signals (reactions, pokes, nudges) + realtime
- `src/hooks/useCheckin.ts` — check-in state + status_emoji
- `src/hooks/useUrgentSignal.ts` — SOS flow
- `src/hooks/useRelationship.ts` — profile + relationship + sessionReady
- `app/_layout.tsx` — root routing, push notification handler
- `supabase/functions/*/index.ts` — all edge functions
- `supabase/migrations/*.sql` — all migrations

## Product direction (decided)

- **Signaler (Mama)** = central role: gives daily sign, builds trusted circle, sends SOS
- **Recipient (Darek)** = primary watcher: receives sign, reacts, responds to SOS
- **Trusted contacts** = Mama's neighbors/friends — she adds them, they get SOS only
- **Monetization (future):** multi-signaler per recipient = premium (family plan)

## What's NOT done / future work

- No onboarding polish for signaler adding trusted contacts
- No "streak freeze" / skip day feature
- No morning push personalization
- No multi-signaler support (V2)
- Performance refactor (hooks parallelization) not done
- Full device push E2E verification — not tested in last session
