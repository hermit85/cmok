-- Add 'poke' and 'morning_thought' to signals.type constraint
-- Poke = standalone gesture, independent from daily check-in

ALTER TABLE public.signals DROP CONSTRAINT IF EXISTS signals_type_check;
ALTER TABLE public.signals ADD CONSTRAINT signals_type_check
  CHECK (type IN ('reaction', 'nudge', 'morning_thought', 'poke'));

-- Index for poke dedup queries (1 per sender per recipient per day)
CREATE INDEX IF NOT EXISTS idx_signals_poke_dedup
  ON public.signals(from_user_id, to_user_id, type, created_at)
  WHERE type = 'poke';
