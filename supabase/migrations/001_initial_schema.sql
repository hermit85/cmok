-- ============================================================
-- Cmok — Senior Safety App
-- Initial database schema
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. USERS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text UNIQUE NOT NULL,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('senior', 'caregiver')),
  checkin_time time DEFAULT '08:00',
  timezone text DEFAULT 'Europe/Warsaw',
  created_at timestamptz DEFAULT now() NOT NULL
);

-- ────────────────────────────────────────────────────────────
-- 2. DEVICE INSTALLATIONS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.device_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('android', 'ios')),
  push_token text,
  notifications_enabled boolean DEFAULT true,
  app_version text,
  last_seen_at timestamptz DEFAULT now() NOT NULL
);

-- ────────────────────────────────────────────────────────────
-- 3. CARE PAIRS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.care_pairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  caregiver_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  priority int DEFAULT 1,
  sms_fallback_phone text NOT NULL,
  invite_code text,
  invite_expires_at timestamptz,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
  joined_at timestamptz,
  UNIQUE(senior_id, caregiver_id)
);

-- ────────────────────────────────────────────────────────────
-- 4. DAILY CHECK-INS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.daily_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  local_date date NOT NULL,
  checked_at timestamptz DEFAULT now() NOT NULL,
  source text NOT NULL CHECK (source IN ('app', 'notification')),
  UNIQUE(senior_id, local_date)
);

-- ────────────────────────────────────────────────────────────
-- 5. ALERT CASES
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.alert_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('sos', 'missed_checkin')),
  state text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'acknowledged', 'resolved', 'cancelled')),
  triggered_at timestamptz DEFAULT now() NOT NULL,
  latitude float,
  longitude float,
  acknowledged_by uuid REFERENCES public.users(id),
  acknowledged_at timestamptz,
  resolved_at timestamptz
);

-- ────────────────────────────────────────────────────────────
-- 6. ALERT DELIVERIES
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.alert_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_case_id uuid NOT NULL REFERENCES public.alert_cases(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('push', 'sms')),
  attempt_no int DEFAULT 1,
  payload jsonb NOT NULL DEFAULT '{}',
  sent_at timestamptz DEFAULT now() NOT NULL,
  delivered_at timestamptz,
  status text DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed'))
);


-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_checkins_senior_date ON public.daily_checkins(senior_id, local_date);
CREATE INDEX idx_alert_cases_senior ON public.alert_cases(senior_id, state);
CREATE INDEX idx_alert_deliveries_case ON public.alert_deliveries(alert_case_id);
CREATE INDEX idx_care_pairs_senior ON public.care_pairs(senior_id, status);
CREATE INDEX idx_care_pairs_invite ON public.care_pairs(invite_code) WHERE invite_code IS NOT NULL;
CREATE INDEX idx_device_user ON public.device_installations(user_id);


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_deliveries ENABLE ROW LEVEL SECURITY;

-- ── users ──
-- Użytkownik widzi i edytuje tylko swój rekord
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ── device_installations ──
-- Użytkownik zarządza swoimi urządzeniami
CREATE POLICY "devices_select_own" ON public.device_installations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "devices_insert_own" ON public.device_installations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "devices_update_own" ON public.device_installations
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "devices_delete_own" ON public.device_installations
  FOR DELETE USING (auth.uid() = user_id);

-- ── care_pairs ──
-- Senior widzi swoje pary
CREATE POLICY "care_pairs_senior_select" ON public.care_pairs
  FOR SELECT USING (auth.uid() = senior_id);

-- Caregiver widzi swoje pary
CREATE POLICY "care_pairs_caregiver_select" ON public.care_pairs
  FOR SELECT USING (auth.uid() = caregiver_id);

-- Caregiver tworzy zaproszenie (insert — caregiver_id = auth.uid())
CREATE POLICY "care_pairs_caregiver_insert" ON public.care_pairs
  FOR INSERT WITH CHECK (auth.uid() = caregiver_id);

-- Senior aktualizuje parę (akceptuje zaproszenie — senior_id = auth.uid())
CREATE POLICY "care_pairs_senior_update" ON public.care_pairs
  FOR UPDATE USING (auth.uid() = senior_id)
  WITH CHECK (auth.uid() = senior_id);

-- Caregiver może aktualizować status pary
CREATE POLICY "care_pairs_caregiver_update" ON public.care_pairs
  FOR UPDATE USING (auth.uid() = caregiver_id)
  WITH CHECK (auth.uid() = caregiver_id);

-- Odczyt care_pairs po invite_code (potrzebne do JoinScreen — senior szuka po kodzie)
CREATE POLICY "care_pairs_select_by_invite" ON public.care_pairs
  FOR SELECT USING (invite_code IS NOT NULL AND status = 'pending');

-- ── daily_checkins ──
-- Senior wstawia i widzi swoje check-iny
CREATE POLICY "checkins_senior_insert" ON public.daily_checkins
  FOR INSERT WITH CHECK (auth.uid() = senior_id);

CREATE POLICY "checkins_senior_select" ON public.daily_checkins
  FOR SELECT USING (auth.uid() = senior_id);

-- Caregiver widzi check-iny swoich seniorów (przez care_pairs)
CREATE POLICY "checkins_caregiver_select" ON public.daily_checkins
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.care_pairs
      WHERE care_pairs.senior_id = daily_checkins.senior_id
        AND care_pairs.caregiver_id = auth.uid()
        AND care_pairs.status = 'active'
    )
  );

-- ── alert_cases ──
-- Senior wstawia i widzi swoje alerty
CREATE POLICY "alerts_senior_insert" ON public.alert_cases
  FOR INSERT WITH CHECK (auth.uid() = senior_id);

CREATE POLICY "alerts_senior_select" ON public.alert_cases
  FOR SELECT USING (auth.uid() = senior_id);

-- Caregiver widzi alerty swoich seniorów (przez care_pairs)
CREATE POLICY "alerts_caregiver_select" ON public.alert_cases
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.care_pairs
      WHERE care_pairs.senior_id = alert_cases.senior_id
        AND care_pairs.caregiver_id = auth.uid()
        AND care_pairs.status = 'active'
    )
  );

-- Caregiver może aktualizować alerty (acknowledge/resolve)
CREATE POLICY "alerts_caregiver_update" ON public.alert_cases
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.care_pairs
      WHERE care_pairs.senior_id = alert_cases.senior_id
        AND care_pairs.caregiver_id = auth.uid()
        AND care_pairs.status = 'active'
    )
  );

-- ── alert_deliveries ──
-- Caregiver widzi dostarczenia kierowane do siebie
CREATE POLICY "deliveries_recipient_select" ON public.alert_deliveries
  FOR SELECT USING (auth.uid() = recipient_id);


-- ============================================================
-- REALTIME
-- ============================================================

-- Włącz Realtime na daily_checkins i alert_cases
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_checkins;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alert_cases;


-- ============================================================
-- INSTRUKCJA URUCHOMIENIA
-- ============================================================
-- Uruchom w Supabase Dashboard → SQL Editor
-- lub: supabase db push (jeśli masz Supabase CLI)
