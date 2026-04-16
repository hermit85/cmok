-- Fix "column reference 'relationship_id' is ambiguous" in add_trusted_contact_by_phone.
-- Root cause: RETURNS TABLE output columns collide with trusted_contacts table columns
-- in INSERT ... ON CONFLICT clause. Solution: prefix output columns with 'out_' +
-- use named constraint in ON CONFLICT + qualify RETURNING with table alias.

DROP FUNCTION IF EXISTS public.add_trusted_contact_by_phone(uuid, text);

CREATE FUNCTION public.add_trusted_contact_by_phone(
  p_relationship_id uuid,
  p_phone text
)
RETURNS TABLE (
  out_trusted_contact_id uuid,
  out_relationship_id uuid,
  out_user_id uuid,
  out_name text,
  out_phone text,
  out_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_relationship public.care_pairs%ROWTYPE;
  v_target public.users%ROWTYPE;
  v_clean_phone text;
  v_contact public.trusted_contacts%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
  INTO v_relationship
  FROM public.care_pairs cp
  WHERE cp.id = p_relationship_id
    AND (cp.caregiver_id = auth.uid() OR cp.senior_id = auth.uid())
    AND cp.status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Relationship not found';
  END IF;

  v_clean_phone := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');

  IF v_clean_phone = '' THEN
    RAISE EXCEPTION 'Phone is required';
  END IF;

  SELECT *
  INTO v_target
  FROM public.users u
  WHERE regexp_replace(u.phone, '\D', '', 'g') = v_clean_phone
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF v_target.id = v_relationship.caregiver_id OR v_target.id = v_relationship.senior_id THEN
    RAISE EXCEPTION 'User already belongs to this relationship';
  END IF;

  INSERT INTO public.trusted_contacts AS tc (
    relationship_id,
    user_id,
    added_by_user_id,
    status
  )
  VALUES (
    v_relationship.id,
    v_target.id,
    auth.uid(),
    'active'
  )
  ON CONFLICT ON CONSTRAINT trusted_contacts_relationship_id_user_id_key
  DO UPDATE SET
    status = 'active',
    added_by_user_id = auth.uid()
  RETURNING tc.*
  INTO v_contact;

  RETURN QUERY
  SELECT
    v_contact.id,
    v_contact.relationship_id,
    v_contact.user_id,
    v_target.name,
    v_target.phone,
    v_contact.status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_trusted_contact_by_phone(uuid, text) TO authenticated;
