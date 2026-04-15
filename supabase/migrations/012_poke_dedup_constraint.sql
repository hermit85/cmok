-- Enforce 1 poke per sender per recipient per day at the DB level.
-- Uses Europe/Warsaw local day to match client-side dedup logic.

CREATE OR REPLACE FUNCTION public.warsaw_date(ts timestamptz) RETURNS date
  LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT (ts AT TIME ZONE 'Europe/Warsaw')::date;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_signals_poke_one_per_day
  ON public.signals (from_user_id, to_user_id, public.warsaw_date(created_at))
  WHERE type = 'poke';
