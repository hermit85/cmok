-- ============================================================
-- Cmok — Seed data (testowe dane)
-- ============================================================
-- UWAGA: Wymaga istniejących użytkowników w auth.users.
-- W środowisku testowym stwórz najpierw dwóch użytkowników
-- przez Supabase Dashboard → Authentication → Add User,
-- a następnie wstaw ich UUID poniżej.
--
-- Poniższe UUID to PLACEHOLDER-y — zamień na prawdziwe.
-- ============================================================

-- Tymczasowe UUID do testów (zamień na prawdziwe po rejestracji)
-- Senior "Mama":   11111111-1111-1111-1111-111111111111
-- Caregiver "Darek": 22222222-2222-2222-2222-222222222222

-- ── 1. Użytkownicy ──
INSERT INTO public.users (id, phone, name, role, checkin_time, timezone)
VALUES
  ('11111111-1111-1111-1111-111111111111', '+48600111222', 'Mama', 'senior', '08:00', 'Europe/Warsaw'),
  ('22222222-2222-2222-2222-222222222222', '+48600333444', 'Darek', 'caregiver', '08:00', 'Europe/Warsaw')
ON CONFLICT (id) DO NOTHING;

-- ── 2. Care pair (aktywna) ──
INSERT INTO public.care_pairs (senior_id, caregiver_id, priority, sms_fallback_phone, status, joined_at)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    1,
    '+48600333444',
    'active',
    now() - interval '30 days'
  )
ON CONFLICT (senior_id, caregiver_id) DO NOTHING;

-- ── 3. Check-iny (ostatnie 5 dni, sobota brakuje) ──
INSERT INTO public.daily_checkins (senior_id, local_date, checked_at, source)
VALUES
  ('11111111-1111-1111-1111-111111111111', CURRENT_DATE - 6, now() - interval '6 days' + interval '8 hours 12 minutes', 'app'),
  ('11111111-1111-1111-1111-111111111111', CURRENT_DATE - 5, now() - interval '5 days' + interval '8 hours 5 minutes',  'app'),
  ('11111111-1111-1111-1111-111111111111', CURRENT_DATE - 4, now() - interval '4 days' + interval '8 hours 32 minutes', 'app'),
  ('11111111-1111-1111-1111-111111111111', CURRENT_DATE - 3, now() - interval '3 days' + interval '9 hours 10 minutes', 'notification'),
  -- CURRENT_DATE - 2 (sobota) → BRAK check-inu
  ('11111111-1111-1111-1111-111111111111', CURRENT_DATE - 1, now() - interval '1 day'  + interval '8 hours 45 minutes', 'app')
ON CONFLICT (senior_id, local_date) DO NOTHING;

-- ── 4. Alert case (resolved — missed_checkin z soboty) ──
INSERT INTO public.alert_cases (senior_id, type, state, triggered_at, acknowledged_by, acknowledged_at, resolved_at)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'missed_checkin',
    'resolved',
    now() - interval '2 days' + interval '9 hours',
    '22222222-2222-2222-2222-222222222222',
    now() - interval '2 days' + interval '9 hours 5 minutes',
    now() - interval '2 days' + interval '9 hours 15 minutes'
  );

-- ============================================================
-- Uruchom po 001_initial_schema.sql
-- Supabase Dashboard → SQL Editor → wklej i wykonaj
-- ============================================================
