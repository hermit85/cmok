-- Optional status emoji on daily check-in (e.g. "on a walk", "at doctor")
ALTER TABLE public.daily_checkins ADD COLUMN IF NOT EXISTS status_emoji text;
