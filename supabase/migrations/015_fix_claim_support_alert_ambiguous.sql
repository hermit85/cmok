-- Fix latent ambiguity in claim_support_alert:
-- RETURNS TABLE(state text) collides with alert_cases.state in UPDATE WHERE.
-- Same pattern as migration 013 for resolve_support_alert.

DROP FUNCTION IF EXISTS public.claim_support_alert(uuid);

CREATE FUNCTION public.claim_support_alert(
  p_alert_id uuid
)
RETURNS TABLE (
  out_alert_id uuid,
  out_state text,
  out_acknowledged_by uuid,
  out_acknowledged_at timestamptz
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
  SET state = 'acknowledged',
      acknowledged_by = auth.uid(),
      acknowledged_at = now()
  WHERE ac.id = p_alert_id
    AND ac.type = 'sos'
    AND ac.state = 'open'
    AND EXISTS (
      SELECT 1
      FROM public.care_pairs cp
      LEFT JOIN public.trusted_contacts tc
        ON tc.relationship_id = cp.id
       AND tc.status = 'active'
      WHERE cp.status = 'active'
        AND cp.senior_id = ac.senior_id
        AND (
          cp.caregiver_id = auth.uid()
          OR tc.user_id = auth.uid()
        )
    )
  RETURNING *
  INTO v_alert;

  IF NOT FOUND THEN
    SELECT *
    INTO v_alert
    FROM public.alert_cases ac2
    WHERE ac2.id = p_alert_id
      AND ac2.type = 'sos'
      AND EXISTS (
        SELECT 1
        FROM public.care_pairs cp
        LEFT JOIN public.trusted_contacts tc
          ON tc.relationship_id = cp.id
         AND tc.status = 'active'
        WHERE cp.status = 'active'
          AND cp.senior_id = ac2.senior_id
          AND (
            cp.caregiver_id = auth.uid()
            OR tc.user_id = auth.uid()
          )
      )
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Alert not found';
  END IF;

  RETURN QUERY
  SELECT
    v_alert.id,
    v_alert.state,
    v_alert.acknowledged_by,
    v_alert.acknowledged_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_support_alert(uuid) TO authenticated;
