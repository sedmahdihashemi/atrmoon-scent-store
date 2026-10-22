BEGIN;

ALTER TABLE public.orders DROP COLUMN IF EXISTS bale_reference_id;

COMMIT;
