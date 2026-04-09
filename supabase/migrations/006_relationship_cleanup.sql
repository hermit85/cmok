-- ============================================================
-- Cmok — Sprint 1 relationship cleanup
-- Finalizuje nowy model ról i bezpieczne przyjmowanie kodu połączenia.
-- Fizycznie zostaje tabela care_pairs, ale aplikacja używa warstwy domenowej
-- "relationship" opartej na rolach signaler / recipient.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. USERS ROLE CLEANUP
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

UPDATE public.users
SET role = CASE role
  WHEN 'senior' THEN 'signaler'
  WHEN 'caregiver' THEN 'recipient'
  ELSE role
END;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('signaler', 'recipient'));


-- ────────────────────────────────────────────────────────────
-- 2. CARE PAIRS CLEANUP
-- care_pairs stays as storage, but we stop relying on legacy invitation hacks.
-- senior_id = signaler user id
-- caregiver_id = recipient user id
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.care_pairs
  ALTER COLUMN sms_fallback_phone DROP NOT NULL;

ALTER TABLE public.care_pairs
  ADD COLUMN IF NOT EXISTS signaler_label text;

UPDATE public.care_pairs
SET signaler_label = COALESCE(signaler_label, senior_name)
WHERE senior_name IS NOT NULL;

-- Stary Invite flow zapisywał placeholder pending rows z senior_id = caregiver_id.
-- Normalizujemy je do nowego modelu pending przed dodaniem constraintu.
UPDATE public.care_pairs
SET senior_id = NULL
WHERE status = 'pending'
  AND senior_id IS NOT NULL
  AND senior_id = caregiver_id;

ALTER TABLE public.care_pairs
  DROP CONSTRAINT IF EXISTS care_pairs_relationship_state_check;

ALTER TABLE public.care_pairs
  ADD CONSTRAINT care_pairs_relationship_state_check
  CHECK (
    (status = 'pending' AND senior_id IS NULL AND invite_code IS NOT NULL)
    OR
    (status = 'active' AND senior_id IS NOT NULL)
  );


-- ────────────────────────────────────────────────────────────
-- 3. RLS CLEANUP
-- Remove direct invite lookup / direct signaler update path.
-- Signaler joins only through security-definer RPC below.
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "care_pairs_select_by_invite" ON public.care_pairs;
DROP POLICY IF EXISTS "care_pairs_senior_update" ON public.care_pairs;


-- ────────────────────────────────────────────────────────────
-- 4. SAFE INVITE ACCEPT FLOW
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.accept_relationship_invite(p_invite_code text)
RETURNS TABLE (
  relationship_id uuid,
  status text,
  recipient_user_id uuid,
  signaler_user_id uuid,
  signaler_label text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pair public.care_pairs%ROWTYPE;
  v_role text;
  v_clean_code text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role
  INTO v_role
  FROM public.users
  WHERE id = auth.uid();

  IF v_role IS DISTINCT FROM 'signaler' THEN
    RAISE EXCEPTION 'Only signalers can accept invites';
  END IF;

  v_clean_code := regexp_replace(COALESCE(p_invite_code, ''), '\D', '', 'g');

  SELECT *
  INTO v_pair
  FROM public.care_pairs
  WHERE invite_code = v_clean_code
    AND status = 'pending'
    AND invite_expires_at > now()
  ORDER BY invite_expires_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found or expired';
  END IF;

  IF v_pair.caregiver_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot accept your own invite';
  END IF;

  UPDATE public.care_pairs
  SET senior_id = auth.uid(),
      status = 'active',
      joined_at = now(),
      invite_code = NULL
  WHERE id = v_pair.id
  RETURNING *
  INTO v_pair;

  RETURN QUERY
  SELECT
    v_pair.id,
    v_pair.status,
    v_pair.caregiver_id,
    v_pair.senior_id,
    COALESCE(v_pair.signaler_label, v_pair.senior_name);
END;
$$;

REVOKE ALL ON FUNCTION public.accept_relationship_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_relationship_invite(text) TO authenticated;
