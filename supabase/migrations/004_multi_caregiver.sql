-- ============================================================
-- Cmok — Sprint 5: Multi-caregiver + Signals
-- Tabela sygnałów zwrotnych (emoji reactions) między kręgiem bliskich
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. SIGNALS TABLE
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('reaction', 'nudge')),
  emoji text,
  message text,
  created_at timestamptz DEFAULT now() NOT NULL,
  seen_at timestamptz
);

-- ────────────────────────────────────────────────────────────
-- 2. INDEXES
-- ────────────────────────────────────────────────────────────
CREATE INDEX idx_signals_to_user ON public.signals(to_user_id, created_at DESC);
CREATE INDEX idx_signals_from_user ON public.signals(from_user_id, created_at DESC);

-- ────────────────────────────────────────────────────────────
-- 3. ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;

-- Użytkownik widzi sygnały wysłane do siebie
CREATE POLICY "signals_select_received" ON public.signals
  FOR SELECT USING (auth.uid() = to_user_id);

-- Użytkownik widzi sygnały wysłane przez siebie
CREATE POLICY "signals_select_sent" ON public.signals
  FOR SELECT USING (auth.uid() = from_user_id);

-- Użytkownik może wysyłać sygnały TYLKO do osób w swoim aktywnym kręgu
CREATE POLICY "signals_insert_circle" ON public.signals
  FOR INSERT WITH CHECK (
    auth.uid() = from_user_id
    AND EXISTS (
      SELECT 1 FROM public.care_pairs
      WHERE status = 'active'
        AND (
          (senior_id = from_user_id AND caregiver_id = to_user_id)
          OR (caregiver_id = from_user_id AND senior_id = to_user_id)
        )
    )
  );

-- Użytkownik może oznaczyć swoje odebrane sygnały jako przeczytane
CREATE POLICY "signals_update_seen" ON public.signals
  FOR UPDATE USING (auth.uid() = to_user_id);

-- ────────────────────────────────────────────────────────────
-- 4. USERS CIRCLE VISIBILITY
-- Pozwól użytkownikom widzieć imiona osób w ich aktywnym kręgu
-- (potrzebne do JOIN w useCircle hook)
-- ────────────────────────────────────────────────────────────
CREATE POLICY "users_select_circle" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.care_pairs
      WHERE status = 'active'
        AND (
          (senior_id = auth.uid() AND caregiver_id = users.id)
          OR (caregiver_id = auth.uid() AND senior_id = users.id)
        )
    )
  );

-- ────────────────────────────────────────────────────────────
-- 5. REALTIME
-- ────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.signals;

-- ============================================================
-- Uruchom w Supabase Dashboard → SQL Editor
-- po 001, 002, 003
-- ============================================================
