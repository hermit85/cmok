-- Privacy-aware view of the trusted circle (RODO compliance).
-- Replaces direct client-side select on users table for trusted contacts.
--
-- Phone visibility rules:
-- - Pair owner (signaler or recipient): sees all phones in their circle
-- - The contact themselves: sees own phone
-- - The person who added the contact: sees the phone
-- - Other trusted members: phone is NULL (masked in UI)
--
-- This implements RODO Art. 5 (data minimization) and Art. 25 (privacy by default).

CREATE OR REPLACE FUNCTION public.get_trusted_circle(
  p_relationship_id uuid
)
RETURNS TABLE (
  trusted_contact_id uuid,
  user_id uuid,
  name text,
  phone text,
  status text,
  is_self boolean,
  is_addable_by_me boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_pair public.care_pairs%ROWTYPE;
  v_is_pair_owner boolean;
  v_is_trusted_member boolean;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_pair
  FROM public.care_pairs cp
  WHERE cp.id = p_relationship_id AND cp.status = 'active';

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_is_pair_owner := (v_pair.senior_id = v_caller OR v_pair.caregiver_id = v_caller);

  v_is_trusted_member := EXISTS (
    SELECT 1 FROM public.trusted_contacts tc
    WHERE tc.relationship_id = p_relationship_id
      AND tc.user_id = v_caller
      AND tc.status = 'active'
  );

  IF NOT v_is_pair_owner AND NOT v_is_trusted_member THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    tc.id AS trusted_contact_id,
    tc.user_id,
    u.name,
    CASE
      WHEN v_is_pair_owner THEN u.phone
      WHEN tc.user_id = v_caller THEN u.phone
      WHEN tc.added_by_user_id = v_caller THEN u.phone
      ELSE NULL
    END AS phone,
    tc.status,
    (tc.user_id = v_caller) AS is_self,
    (v_is_pair_owner OR tc.added_by_user_id = v_caller) AS is_addable_by_me
  FROM public.trusted_contacts tc
  JOIN public.users u ON u.id = tc.user_id
  WHERE tc.relationship_id = p_relationship_id
    AND tc.status = 'active'
  ORDER BY tc.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_trusted_circle(uuid) TO authenticated;
