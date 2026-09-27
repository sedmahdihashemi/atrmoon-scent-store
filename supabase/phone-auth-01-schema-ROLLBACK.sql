BEGIN;

-- This only removes the new constraints. It does NOT restore the phone
-- values that were cleared/normalized by the forward migration — that data
-- change isn't reversible from here.
DROP INDEX IF EXISTS public.profiles_phone_unique_idx;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_phone_format_check;

COMMIT;
