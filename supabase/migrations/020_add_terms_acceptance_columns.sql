-- ============================================================
-- Cmok — add terms/privacy acceptance columns to users
-- ============================================================
-- PhoneVerifyScreen (client) upserts these three fields after
-- successful OTP verify. Without the columns the upsert errors
-- out silently, which pollutes console logs and prevents
-- consent from ever being recorded.
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version text,
  ADD COLUMN IF NOT EXISTS privacy_version text;
