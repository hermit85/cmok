-- Track whether a push notification was sent for this check-in
ALTER TABLE public.daily_checkins
  ADD COLUMN notification_sent_at timestamptz;
