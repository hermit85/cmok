-- Bring the source schema in line with the trusted-contact invite flow:
-- unknown phone numbers create pending trusted_contacts rows that are
-- activated by activate_pending_trusted_contacts() when that phone signs in.

ALTER TABLE public.trusted_contacts
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.trusted_contacts
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS invite_code text,
  ADD COLUMN IF NOT EXISTS invite_expires_at timestamptz;

ALTER TABLE public.trusted_contacts
  DROP CONSTRAINT IF EXISTS trusted_contacts_status_check;

ALTER TABLE public.trusted_contacts
  ADD CONSTRAINT trusted_contacts_status_check
  CHECK (status IN ('active', 'pending', 'removed'));

CREATE INDEX IF NOT EXISTS idx_trusted_contacts_pending_phone
  ON public.trusted_contacts(relationship_id, phone)
  WHERE status = 'pending' AND user_id IS NULL AND phone IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_trusted_contacts_pending_invite_code
  ON public.trusted_contacts(invite_code)
  WHERE status = 'pending' AND invite_code IS NOT NULL;

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
  out_status text,
  out_invite_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_relationship public.care_pairs%ROWTYPE;
  v_target public.users%ROWTYPE;
  v_clean_phone text;
  v_stored_phone text;
  v_contact public.trusted_contacts%ROWTYPE;
  v_invite_code text;
  v_attempt int := 0;
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

  v_stored_phone := '+' || v_clean_phone;

  SELECT *
  INTO v_target
  FROM public.users u
  WHERE regexp_replace(u.phone, '\D', '', 'g') = v_clean_phone
  LIMIT 1;

  IF FOUND THEN
    IF v_target.id = v_relationship.caregiver_id OR v_target.id = v_relationship.senior_id THEN
      RAISE EXCEPTION 'User already belongs to this relationship';
    END IF;

    INSERT INTO public.trusted_contacts AS tc (
      relationship_id,
      user_id,
      added_by_user_id,
      status,
      phone,
      invite_code,
      invite_expires_at
    )
    VALUES (
      v_relationship.id,
      v_target.id,
      auth.uid(),
      'active',
      NULL,
      NULL,
      NULL
    )
    ON CONFLICT ON CONSTRAINT trusted_contacts_relationship_id_user_id_key
    DO UPDATE SET
      status = 'active',
      added_by_user_id = auth.uid(),
      phone = NULL,
      invite_code = NULL,
      invite_expires_at = NULL
    RETURNING tc.*
    INTO v_contact;

    RETURN QUERY
    SELECT
      v_contact.id,
      v_contact.relationship_id,
      v_contact.user_id,
      v_target.name,
      v_target.phone,
      v_contact.status,
      v_contact.invite_code;
    RETURN;
  END IF;

  SELECT *
  INTO v_contact
  FROM public.trusted_contacts tc
  WHERE tc.relationship_id = v_relationship.id
    AND tc.user_id IS NULL
    AND tc.status = 'pending'
    AND regexp_replace(COALESCE(tc.phone, ''), '\D', '', 'g') = v_clean_phone
  ORDER BY tc.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    LOOP
      v_attempt := v_attempt + 1;
      v_invite_code := lpad(floor(random() * 1000000)::int::text, 6, '0');
      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM public.trusted_contacts tc
        WHERE tc.status = 'pending'
          AND tc.invite_code = v_invite_code
      );
      IF v_attempt >= 20 THEN
        RAISE EXCEPTION 'Could not generate invite code';
      END IF;
    END LOOP;

    INSERT INTO public.trusted_contacts AS tc (
      relationship_id,
      user_id,
      added_by_user_id,
      status,
      phone,
      invite_code,
      invite_expires_at
    )
    VALUES (
      v_relationship.id,
      NULL,
      auth.uid(),
      'pending',
      v_stored_phone,
      v_invite_code,
      now() + interval '30 days'
    )
    RETURNING tc.*
    INTO v_contact;
  ELSE
    IF v_contact.invite_code IS NULL OR v_contact.invite_expires_at IS NULL OR v_contact.invite_expires_at <= now() THEN
      LOOP
        v_attempt := v_attempt + 1;
        v_invite_code := lpad(floor(random() * 1000000)::int::text, 6, '0');
        EXIT WHEN NOT EXISTS (
          SELECT 1
          FROM public.trusted_contacts tc
          WHERE tc.status = 'pending'
            AND tc.invite_code = v_invite_code
            AND tc.id <> v_contact.id
        );
        IF v_attempt >= 20 THEN
          RAISE EXCEPTION 'Could not generate invite code';
        END IF;
      END LOOP;
    ELSE
      v_invite_code := v_contact.invite_code;
    END IF;

    UPDATE public.trusted_contacts AS tc
    SET added_by_user_id = auth.uid(),
        phone = v_stored_phone,
        invite_code = v_invite_code,
        invite_expires_at = now() + interval '30 days',
        status = 'pending'
    WHERE tc.id = v_contact.id
    RETURNING tc.*
    INTO v_contact;
  END IF;

  RETURN QUERY
  SELECT
    v_contact.id,
    v_contact.relationship_id,
    v_contact.user_id,
    'Oczekuje'::text,
    v_contact.phone,
    v_contact.status,
    v_contact.invite_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_trusted_contact_by_phone(uuid, text) TO authenticated;

DROP FUNCTION IF EXISTS public.get_trusted_circle(uuid);

CREATE OR REPLACE FUNCTION public.get_trusted_circle(
  p_relationship_id uuid
)
RETURNS TABLE (
  trusted_contact_id uuid,
  user_id uuid,
  name text,
  phone text,
  status text,
  invite_code text,
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
    COALESCE(u.name, 'Oczekuje') AS name,
    CASE
      WHEN tc.user_id IS NULL AND (v_is_pair_owner OR tc.added_by_user_id = v_caller) THEN tc.phone
      WHEN v_is_pair_owner THEN u.phone
      WHEN tc.user_id = v_caller THEN u.phone
      WHEN tc.added_by_user_id = v_caller THEN u.phone
      ELSE NULL
    END AS phone,
    tc.status,
    tc.invite_code,
    (tc.user_id = v_caller) AS is_self,
    (v_is_pair_owner OR tc.added_by_user_id = v_caller) AS is_addable_by_me
  FROM public.trusted_contacts tc
  LEFT JOIN public.users u ON u.id = tc.user_id
  WHERE tc.relationship_id = p_relationship_id
    AND (
      tc.status = 'active'
      OR (
        tc.status = 'pending'
        AND (v_is_pair_owner OR tc.added_by_user_id = v_caller)
      )
    )
  ORDER BY tc.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_trusted_circle(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_trusted_contact(
  p_trusted_contact_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact public.trusted_contacts%ROWTYPE;
  v_relationship public.care_pairs%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
  INTO v_contact
  FROM public.trusted_contacts
  WHERE id = p_trusted_contact_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trusted contact not found';
  END IF;

  SELECT *
  INTO v_relationship
  FROM public.care_pairs
  WHERE id = v_contact.relationship_id
  LIMIT 1;

  IF NOT FOUND
    OR (
      v_relationship.caregiver_id <> auth.uid()
      AND v_relationship.senior_id <> auth.uid()
      AND v_contact.added_by_user_id <> auth.uid()
    )
  THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  UPDATE public.trusted_contacts
  SET status = 'removed',
      invite_code = NULL,
      invite_expires_at = NULL
  WHERE id = p_trusted_contact_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_trusted_contact(uuid) TO authenticated;
