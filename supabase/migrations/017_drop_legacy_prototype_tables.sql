-- Drop legacy prototype tables (family-based model) that had permissive RLS
-- and were not used by current cmok codebase. Security cleanup flagged by audit.

DROP TABLE IF EXISTS public.cmoks CASCADE;
DROP TABLE IF EXISTS public.members CASCADE;
DROP TABLE IF EXISTS public.families CASCADE;
