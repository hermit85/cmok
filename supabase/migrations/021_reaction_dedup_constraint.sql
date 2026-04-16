-- 021_reaction_dedup_constraint.sql
--
-- Enforce 1 reaction per sender per recipient per day at the DB level.
-- Mirrors migration 012 (which covered 'poke'). Uses Europe/Warsaw local
-- day to match client-side dedup logic in src/hooks/useSignals.ts.

CREATE UNIQUE INDEX IF NOT EXISTS idx_signals_reaction_one_per_day
  ON public.signals (from_user_id, to_user_id, public.warsaw_date(created_at))
  WHERE type = 'reaction';
