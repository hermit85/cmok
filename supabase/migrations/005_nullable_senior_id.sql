-- ============================================================
-- Cmok — Make senior_id nullable + add senior_name to care_pairs
--
-- SetupScreen creates care_pairs with senior_id=NULL
-- (senior fills it when joining via invite code)
-- ============================================================

-- Drop the UNIQUE constraint first (it includes senior_id)
ALTER TABLE public.care_pairs DROP CONSTRAINT IF EXISTS care_pairs_senior_id_caregiver_id_key;

-- Make senior_id nullable
ALTER TABLE public.care_pairs ALTER COLUMN senior_id DROP NOT NULL;

-- Add senior_name column (name the caregiver gave to the senior, e.g. "Mama")
ALTER TABLE public.care_pairs ADD COLUMN IF NOT EXISTS senior_name text;

-- Re-create unique constraint that allows NULL senior_id
-- (PostgreSQL treats NULLs as distinct in unique constraints by default)
CREATE UNIQUE INDEX IF NOT EXISTS care_pairs_senior_caregiver_unique
  ON public.care_pairs (senior_id, caregiver_id)
  WHERE senior_id IS NOT NULL;
