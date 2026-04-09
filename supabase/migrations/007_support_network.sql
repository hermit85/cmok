-- ============================================================
-- Cmok — Sprint 3 support network
-- Minimalny model Osób zaufanych i claimowania aktywnej sprawy.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. TRUSTED CONTACTS
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.trusted_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id uuid NOT NULL REFERENCES public.care_pairs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  added_by_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (relationship_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_trusted_contacts_relationship
  ON public.trusted_contacts(relationship_id, status);

CREATE INDEX IF NOT EXISTS idx_trusted_contacts_user
  ON public.trusted_contacts(user_id, status);

ALTER TABLE public.trusted_contacts ENABLE ROW LEVEL SECURITY;


-- ────────────────────────────────────────────────────────────
-- 2. RLS — RELATIONSHIP / CONTACT VISIBILITY
-- ────────────────────────────────────────────────────────────

CREATE POLICY "care_pairs_trusted_select" ON public.care_pairs
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.trusted_contacts
      WHERE trusted_contacts.relationship_id = care_pairs.id
        AND trusted_contacts.user_id = auth.uid()
        AND trusted_contacts.status = 'active'
    )
  );

CREATE POLICY "trusted_contacts_select_visible" ON public.trusted_contacts
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.care_pairs
      WHERE care_pairs.id = trusted_contacts.relationship_id
        AND care_pairs.status = 'active'
        AND (
          care_pairs.senior_id = auth.uid()
          OR care_pairs.caregiver_id = auth.uid()
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.trusted_contacts AS viewer_contacts
      WHERE viewer_contacts.relationship_id = trusted_contacts.relationship_id
        AND viewer_contacts.user_id = auth.uid()
        AND viewer_contacts.status = 'active'
    )
  );

CREATE POLICY "users_select_support_network" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.care_pairs
      LEFT JOIN public.trusted_contacts AS viewer_contacts
        ON viewer_contacts.relationship_id = care_pairs.id
       AND viewer_contacts.status = 'active'
       AND viewer_contacts.user_id = auth.uid()
      LEFT JOIN public.trusted_contacts AS target_contacts
        ON target_contacts.relationship_id = care_pairs.id
       AND target_contacts.status = 'active'
       AND target_contacts.user_id = public.users.id
      WHERE care_pairs.status = 'active'
        AND (
          (
            care_pairs.senior_id = auth.uid()
            AND (public.users.id = care_pairs.caregiver_id OR target_contacts.id IS NOT NULL)
          )
          OR
          (
            care_pairs.caregiver_id = auth.uid()
            AND (public.users.id = care_pairs.senior_id OR target_contacts.id IS NOT NULL)
          )
          OR
          (
            viewer_contacts.id IS NOT NULL
            AND (
              public.users.id = care_pairs.senior_id
              OR public.users.id = care_pairs.caregiver_id
              OR target_contacts.id IS NOT NULL
            )
          )
        )
    )
  );


-- ────────────────────────────────────────────────────────────
-- 3. RLS — SUPPORT CASE VISIBILITY
-- ────────────────────────────────────────────────────────────

CREATE POLICY "alerts_trusted_select" ON public.alert_cases
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.care_pairs
      JOIN public.trusted_contacts
        ON trusted_contacts.relationship_id = care_pairs.id
       AND trusted_contacts.status = 'active'
      WHERE care_pairs.status = 'active'
        AND care_pairs.senior_id = alert_cases.senior_id
        AND trusted_contacts.user_id = auth.uid()
    )
  );

CREATE POLICY "deliveries_support_case_select" ON public.alert_deliveries
  FOR SELECT USING (
    auth.uid() = recipient_id
    OR EXISTS (
      SELECT 1
      FROM public.alert_cases
      WHERE alert_cases.id = alert_deliveries.alert_case_id
        AND alert_cases.senior_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.alert_cases
      JOIN public.care_pairs
        ON care_pairs.senior_id = alert_cases.senior_id
       AND care_pairs.status = 'active'
      WHERE alert_cases.id = alert_deliveries.alert_case_id
        AND care_pairs.caregiver_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.alert_cases
      JOIN public.care_pairs
        ON care_pairs.senior_id = alert_cases.senior_id
       AND care_pairs.status = 'active'
      JOIN public.trusted_contacts
        ON trusted_contacts.relationship_id = care_pairs.id
       AND trusted_contacts.status = 'active'
      WHERE alert_cases.id = alert_deliveries.alert_case_id
        AND trusted_contacts.user_id = auth.uid()
    )
  );


-- ────────────────────────────────────────────────────────────
-- 4. RPC — MANAGE TRUSTED CONTACTS
-- ────────────────────────────────────────────────────────────

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
  FROM public.care_pairs
  WHERE id = p_relationship_id
    AND caregiver_id = auth.uid()
    AND status = 'active'
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
  FROM public.users
  WHERE regexp_replace(phone, '\D', '', 'g') = v_clean_phone
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF v_target.id = v_relationship.caregiver_id OR v_target.id = v_relationship.senior_id THEN
    RAISE EXCEPTION 'User already belongs to this relationship';
  END IF;

  INSERT INTO public.trusted_contacts (
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

  IF NOT FOUND OR v_relationship.caregiver_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  UPDATE public.trusted_contacts
  SET status = 'removed'
  WHERE id = p_trusted_contact_id;
END;
$$;


-- ────────────────────────────────────────────────────────────
-- 5. RPC — SUPPORT OWNERSHIP
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.claim_support_alert(
  p_alert_id uuid
)
RETURNS TABLE (
  alert_id uuid,
  state text,
  acknowledged_by uuid,
  acknowledged_at timestamptz
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

  UPDATE public.alert_cases
  SET state = 'acknowledged',
      acknowledged_by = auth.uid(),
      acknowledged_at = now()
  WHERE id = p_alert_id
    AND type = 'sos'
    AND state = 'open'
    AND EXISTS (
      SELECT 1
      FROM public.care_pairs
      LEFT JOIN public.trusted_contacts
        ON trusted_contacts.relationship_id = care_pairs.id
       AND trusted_contacts.status = 'active'
      WHERE care_pairs.status = 'active'
        AND care_pairs.senior_id = alert_cases.senior_id
        AND (
          care_pairs.caregiver_id = auth.uid()
          OR trusted_contacts.user_id = auth.uid()
        )
    )
  RETURNING *
  INTO v_alert;

  IF NOT FOUND THEN
    SELECT *
    INTO v_alert
    FROM public.alert_cases
    WHERE id = p_alert_id
      AND type = 'sos'
      AND EXISTS (
        SELECT 1
        FROM public.care_pairs
        LEFT JOIN public.trusted_contacts
          ON trusted_contacts.relationship_id = care_pairs.id
         AND trusted_contacts.status = 'active'
        WHERE care_pairs.status = 'active'
          AND care_pairs.senior_id = alert_cases.senior_id
          AND (
            care_pairs.caregiver_id = auth.uid()
            OR trusted_contacts.user_id = auth.uid()
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

CREATE OR REPLACE FUNCTION public.resolve_support_alert(
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

  UPDATE public.alert_cases
  SET state = 'resolved',
      resolved_at = now()
  WHERE id = p_alert_id
    AND type = 'sos'
    AND acknowledged_by = auth.uid()
    AND state IN ('open', 'acknowledged')
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

REVOKE ALL ON FUNCTION public.add_trusted_contact_by_phone(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_trusted_contact(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_support_alert(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_support_alert(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.add_trusted_contact_by_phone(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_trusted_contact(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_support_alert(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_support_alert(uuid) TO authenticated;
