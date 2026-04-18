# E2E Tests — Maestro

End-to-end smoke tests for cmok's critical flows. Runs against the iOS
Simulator (or a physical device / Android) using
[Maestro](https://maestro.mobile.dev/) — a YAML-based UI testing tool.

We picked Maestro over Detox because:
- zero native config, works with Expo out of the box (no custom build)
- flows are readable YAML, reviewable as product spec
- fast loop: edit + re-run in seconds
- Maestro Cloud gives cross-device runs if/when we need them

## Install

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
# Then add to PATH per the installer's instructions (one line in ~/.zshrc)
maestro --version
```

## Before running — reset test data

Flows assume the Supabase test accounts defined in `CLAUDE.md`:

- `+48 500 000 001` (Mama, signaler) OTP `123456`
- `+48 500 000 002` (Darek, recipient) OTP `123456`
- `+48 500 000 003` (Sąsiad, trusted) OTP `123456`

Depending on the flow you'll want the database in a specific state:

```bash
# Clear signals/checkins/alerts but keep the Mama↔Darek pair + auth rows.
# Best for running most flows which assume paired state.
curl -X POST https://pckpxspcecbvjprxmdja.supabase.co/functions/v1/reset-test-data \
  -H "Content-Type: application/json" \
  -d '{"mode": "keep_pair"}'

# Full wipe — delete all test accounts. Use before running
# onboarding-recipient.yaml to exercise a fresh signup from scratch.
curl -X POST https://pckpxspcecbvjprxmdja.supabase.co/functions/v1/reset-test-data \
  -H "Content-Type: application/json" \
  -d '{"mode": "full_reset"}'
```

## Run

```bash
# Run everything
maestro test .maestro/

# Run one flow
maestro test .maestro/checkin-flow.yaml

# Debug with screen recording
maestro test --debug-output ./maestro-debug .maestro/checkin-flow.yaml
```

On iOS make sure a simulator is booted first:
```bash
xcrun simctl boot "iPhone 17 Pro"
open -a Simulator
```

## Flows included

| File | What it covers |
|------|----------------|
| `onboarding-recipient.yaml` | Fresh recipient signup → invite code generation |
| `onboarding-signaler.yaml`  | Signaler redeems an invite code (swap the code before running) |
| `checkin-flow.yaml`         | Mama taps "daj znak" → picks mood → sees both confirmation pills |
| `recipient-reaction.yaml`   | Darek sees "Jest znak" → reacts → peer rec card appears |
| `trusted-invite.yaml`       | Mama adds a non-cmok number → pending row + invite code + Share sheet |
| `sos-flow.yaml`             | Mama triggers SOS → resolves → PostResolveShare overlay appears |
| `add-pair.yaml`             | Darek invites a second signaler via `/add-pair` (P2.1 multi-pair) |

## Known limitations

- `onboarding-signaler.yaml` has a hardcoded `111222` invite code. Live
  codes come from `care_pairs.invite_code` and change every run. In CI
  we'd fetch it from the DB via a helper script; for local runs swap
  the code manually before executing.
- Some Polish diacritics (ś, ą, ć, ę, ł, ń, ó, ź, ż) in `inputText`
  depend on the simulator keyboard layout. Switch to
  "Polski (Programista)" in Settings → General → Keyboard if flows
  fail on text input.
- PostHog events fire during tests. If you need a clean staging we
  should split to a separate PostHog project keyed by env.
- SMS OTP is bypassed for test accounts via the reserved `123456`
  code (see `CLAUDE.md`). Real-phone OTP won't work for Maestro.

## CI integration (future)

Once Maestro Cloud token is set up, wire into GitHub Actions:

```yaml
- name: Maestro Cloud
  uses: mobile-dev-inc/action-maestro-cloud@v1
  with:
    api-key: ${{ secrets.MAESTRO_CLOUD_API_KEY }}
    app-file: ios-build/Cmok.app
```

Gated on iOS build artifact from the EAS Build pipeline.

## Writing new flows

- Check what accessibility labels exist — most `Pressable`s in cmok
  already have `accessibilityLabel` (per brand rule). Maestro matches
  against visible text *or* accessibility id/label.
- Prefer `tapOn: "Visible Polish text"` over coordinate-based taps.
- Use `optional: true` on selectors that may or may not appear (e.g.
  push-permission banner on first launch).
- Keep flows focused — one user goal per file. Mixing flows
  (login + checkin + settings) makes failure attribution painful.
