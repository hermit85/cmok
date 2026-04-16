-- 020_invite_code_unique.sql
--
-- Enforce uniqueness of active invite codes. Without this, two users could
-- simultaneously generate the same 6-digit code (birthday-paradox risk is
-- low but non-zero), and a senior could join the wrong pair.
--
-- We only enforce uniqueness for pending invites with a non-null code —
-- after a pair is joined, the code is nulled (see 006_relationship_cleanup.sql)
-- and historical rows may reuse numbers.
--
-- SAFETY: pre-dedup existing duplicates BEFORE creating the unique index,
-- otherwise the migration will fail on production data that already has
-- collisions. For each duplicate pending invite_code we keep the row with
-- the latest expiry and rewrite the losers to a fresh random 6-digit code
-- that doesn't collide.

DO $$
DECLARE
  rec record;
  candidate text;
BEGIN
  FOR rec IN
    SELECT id
    FROM (
      SELECT id,
             row_number() OVER (
               PARTITION BY invite_code
               ORDER BY invite_expires_at DESC NULLS LAST, id DESC
             ) AS rn
      FROM public.care_pairs
      WHERE status = 'pending'
        AND invite_code IS NOT NULL
    ) t
    WHERE rn > 1
  LOOP
    LOOP
      candidate := lpad((floor(random() * 1000000))::int::text, 6, '0');
      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM public.care_pairs
        WHERE status = 'pending'
          AND invite_code = candidate
      );
    END LOOP;

    UPDATE public.care_pairs
    SET invite_code = candidate
    WHERE id = rec.id;
  END LOOP;
END $$;

-- Drop the old non-unique partial index if present (it was superseded)
DROP INDEX IF EXISTS public.idx_care_pairs_invite;

CREATE UNIQUE INDEX IF NOT EXISTS idx_care_pairs_invite_unique
  ON public.care_pairs (invite_code)
  WHERE invite_code IS NOT NULL AND status = 'pending';
