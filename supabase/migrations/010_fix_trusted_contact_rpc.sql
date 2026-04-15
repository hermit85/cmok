-- Fix "column reference 'status' is ambiguous" in add_trusted_contact_by_phone.
-- The RETURNS TABLE output column 'status' collides with table columns of the same name.
-- Solution: qualify all bare 'status' references with table names.

CREATE OR REPLACE FUNCTION public.add_trusted_contact_by_phone(
  p_relationship_id uuid,
  p_phone text
)
RETURNS TABLE (
  trusted_contact_id uuid,
  relationship_id uuid,
  user_id uuid,
  name text,
  phone text,
  status text
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
    AND cp.caregiver_id = auth.uid()
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
  ON CONFLICT (relationship_id, user_id)
  DO UPDATE SET
    status = 'active',
    added_by_user_id = auth.uid()
  RETURNING *
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
