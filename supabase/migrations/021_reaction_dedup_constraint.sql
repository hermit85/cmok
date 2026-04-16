-- 021_reaction_dedup_constraint.sql
--
-- Enforce 1 reaction per sender per recipient per day at the DB level.
-- Mirrors migration 012 (which covered 'poke'). Uses Europe/Warsaw local
-- day to match client-side dedup logic in src/hooks/useSignals.ts.
--
-- SAFETY: pre-dedup existing duplicates BEFORE creating the unique index,
-- otherwise the migration will fail on production data. For each (sender,
-- recipient, local_day, type='reaction') group we keep the most recent row
-- and delete older duplicates.

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY from_user_id, to_user_id, public.warsaw_date(created_at)
           ORDER BY created_at DESC, id DESC
         ) AS rn
  FROM public.signals
  WHERE type = 'reaction'
)
DELETE FROM public.signals s
USING ranked r
WHERE s.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_signals_reaction_one_per_day
  ON public.signals (from_user_id, to_user_id, public.warsaw_date(created_at))
  WHERE type = 'reaction';
