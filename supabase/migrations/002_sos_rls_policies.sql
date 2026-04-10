-- ============================================================
-- Cmok — SOS RLS policies (Sprint 3)
-- Dodatkowe polityki potrzebne do flow SOS
-- ============================================================

-- Senior może UPDATE swoje alert_cases (cancel alarm)
CREATE POLICY "alerts_senior_update" ON public.alert_cases
  FOR UPDATE USING (auth.uid() = senior_id)
  WITH CHECK (auth.uid() = senior_id);

-- Senior może INSERT do alert_deliveries (tworzy delivery przy SOS)
CREATE POLICY "deliveries_senior_insert" ON public.alert_deliveries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.alert_cases
      WHERE alert_cases.id = alert_deliveries.alert_case_id
        AND alert_cases.senior_id = auth.uid()
    )
  );

-- ============================================================
-- Uruchom w Supabase Dashboard → SQL Editor
-- po 001_initial_schema.sql
-- ============================================================
