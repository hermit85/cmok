-- Allow signaler (senior_id) to resolve their own SOS alert, not just the claimer.
-- Previously only acknowledged_by could resolve, but signaler triggers "Już jest dobrze".

-- Allow signaler (senior_id) to resolve their own SOS alert.
-- Qualify all column references with table alias to avoid ambiguity
-- with RETURNS TABLE output columns.

DROP FUNCTION IF EXISTS public.resolve_support_alert(uuid);

CREATE FUNCTION public.resolve_support_alert(
  p_alert_id uuid
)
RETURNS TABLE (
  alert_id uuid,
  state text,
  resolved_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alert public.alert_cases%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.alert_cases ac
  SET state = 'resolved',
      resolved_at = now()
  WHERE ac.id = p_alert_id
    AND ac.type = 'sos'
    AND ac.state IN ('open', 'acknowledged')
    AND (ac.senior_id = auth.uid() OR ac.acknowledged_by = auth.uid())
  RETURNING *
  INTO v_alert;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Alert cannot be resolved by this user';
  END IF;

  RETURN QUERY
  SELECT
    v_alert.id,
    v_alert.state,
    v_alert.resolved_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_support_alert(uuid) TO authenticated;
