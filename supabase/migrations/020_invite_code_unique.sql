-- 020_invite_code_unique.sql
--
-- Enforce uniqueness of active invite codes. Without this, two users could
-- simultaneously generate the same 6-digit code (birthday-paradox risk is
-- low but non-zero), and a senior could join the wrong pair.
--
-- We only enforce uniqueness for pending invites with a non-null code —
-- after a pair is joined, the code is nulled (see 006_relationship_cleanup.sql)
-- and historical rows may reuse numbers.

-- Drop the old non-unique partial index if present (it was superseded)
DROP INDEX IF EXISTS public.idx_care_pairs_invite;

CREATE UNIQUE INDEX IF NOT EXISTS idx_care_pairs_invite_unique
  ON public.care_pairs (invite_code)
  WHERE invite_code IS NOT NULL AND status = 'pending';
