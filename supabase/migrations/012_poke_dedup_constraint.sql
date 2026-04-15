-- Enforce 1 poke per sender per recipient per day at the DB level.
-- Client dedup is the first line of defense; this is the safety net.

CREATE OR REPLACE FUNCTION public.utc_date(ts timestamptz) RETURNS date
  LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT (ts AT TIME ZONE 'UTC')::date;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_signals_poke_one_per_day
  ON public.signals (from_user_id, to_user_id, public.utc_date(created_at))
  WHERE type = 'poke';
