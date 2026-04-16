-- Helper RPC for edge functions: check if nudge was sent today (Europe/Warsaw day)
-- Used by nudge-signal to dedup nudges within a local day.

CREATE OR REPLACE FUNCTION public.has_nudge_today(
  p_from uuid,
  p_to uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.signals s
    WHERE s.from_user_id = p_from
      AND s.to_user_id = p_to
      AND s.type = 'nudge'
      AND public.warsaw_date(s.created_at) = public.warsaw_date(now())
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_nudge_today(uuid, uuid) TO authenticated, service_role;
