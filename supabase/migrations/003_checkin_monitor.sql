-- ============================================================
-- Cmok — Sprint 4: checkin-monitor support
-- ============================================================

-- Kolumna last_reminder_date — żeby nie wysyłać push reminderu 2x tego samego dnia
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_reminder_date date;

-- UNIQUE constraint na device_installations(user_id, platform)
-- Potrzebny do UPSERT w register-device
ALTER TABLE public.device_installations
  DROP CONSTRAINT IF EXISTS device_installations_user_platform_unique;

ALTER TABLE public.device_installations
  ADD CONSTRAINT device_installations_user_platform_unique UNIQUE (user_id, platform);

-- Index na alert_cases dla szybkiego sprawdzania duplikatów missed_checkin
CREATE INDEX IF NOT EXISTS idx_alert_cases_senior_type_date
  ON public.alert_cases(senior_id, type, triggered_at);

-- ============================================================
-- Uruchom w Supabase Dashboard → SQL Editor
-- po 001_initial_schema.sql i 002_sos_rls_policies.sql
-- ============================================================
