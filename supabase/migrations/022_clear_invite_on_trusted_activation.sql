-- Trigger activate_pending_trusted_contacts previously only cleared
-- phone on activation, leaving invite_code + invite_expires_at
-- dangling on the row. Not a functional bug but:
--   1. stale data
--   2. if we ever rehydrate a trusted_contacts row by invite_code
--      lookup, the activated row is still matchable
-- Codex review (2026-04-18) flagged this. Fix: clear both fields.

CREATE OR REPLACE FUNCTION public.activate_pending_trusted_contacts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_clean_phone text;
  v_activated_count int;
BEGIN
  v_clean_phone := regexp_replace(COALESCE(NEW.phone, ''), '\D', '', 'g');
  IF v_clean_phone = '' THEN
    RETURN NEW;
  END IF;

  UPDATE public.trusted_contacts tc
  SET user_id = NEW.id,
      status = 'active',
      phone = NULL,
      invite_code = NULL,
      invite_expires_at = NULL
  WHERE tc.user_id IS NULL
    AND tc.status = 'pending'
    AND regexp_replace(COALESCE(tc.phone, ''), '\D', '', 'g') = v_clean_phone;

  GET DIAGNOSTICS v_activated_count = ROW_COUNT;

  -- If the new user had any pending invites activated and their role is null/empty,
  -- mark them as 'trusted'. Onboarding can still override if they pick another role.
  IF v_activated_count > 0 AND (NEW.role IS NULL OR NEW.role = '') THEN
    UPDATE public.users SET role = 'trusted' WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;
