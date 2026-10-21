BEGIN;

ALTER TABLE public.products DROP COLUMN IF EXISTS stock_badge;

COMMIT;
