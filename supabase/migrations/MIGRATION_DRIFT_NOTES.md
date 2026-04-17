# Migration Drift — Snapshot 2026-04-16

## Reality
- Repo has 19 numbered files (`001-019`, missing 008) using sequential prefixes from before we adopted Supabase CLI conventions.
- Production Supabase has 32 entries in `supabase_migrations.schema_migrations` using timestamp prefixes (`20260410102858`, ...).
- The two histories overlap: every change in repo since `006_relationship_cleanup` exists in prod under the timestamp scheme. Entries `001-005` predate the migration table and were applied manually via the dashboard.

## Why we are not rewriting history right now
- Repo migrations are descriptive history for human review — they are not run by CI; prod schema is authoritative.
- All RLS, RPC, and constraint changes for build 18 have been verified live on prod via MCP queries.
- A full `supabase db pull` would require re-introducing the CLI scaffolding (`supabase init`, `config.toml`) and would land a single ~3000-line snapshot, which is harder to review than the focused per-change files.

## Action plan (post-Build 18)
1. Run `supabase init` from repo root, point `project_ref = pckpxspcecbvjprxmdja`.
2. `supabase db pull` to generate a single snapshot file `<timestamp>_remote_schema.sql`.
3. Move the legacy `001-019` files into `migrations/legacy/` for history.
4. New migrations going forward use `supabase migration new <name>` so timestamps stay in sync.

## Reference: prod-only migrations missing from repo
Listed for traceability; all already applied successfully in prod:

| version | name |
|---|---|
| 20260413075645 | fix_accept_invite_cleanup_v2 |
| 20260413092108 | add_terms_accepted_at |
| 20260413122250 | add_consent_versioning |
| 20260414111157 | add_morning_thought_signal_type |
| 20260414111204 | add_care_pairs_senior_update_policy |
| 20260414123934 | make_caregiver_id_nullable |
| 20260414185854 | add_device_installations_unique_constraint |
| 20260414200933 | fix_claim_resolve_security_definer_v2 |
| 20260414201126 | fix_resolve_any_circle_member |
| 20260415062350 | add_alert_senior_update_policy |
| 20260415170500 | fix_resolve_alert_ambiguous_state |
| 20260415170541 | fix_poke_dedup_timezone |
| 20260415180416 | allow_signaler_manage_trusted_contacts |
| 20260415180428 | allow_signaler_remove_trusted_contact |
| 20260416095147 | add_get_alert_participants_rpc |
| 20260416095257 | restore_users_support_network_for_sos |
| 20260416100015 | extend_get_alert_participants_with_delivery |
| 20260416100208 | restrict_users_phone_column_access |
| 20260416100323 | add_get_my_circle_rpc |
