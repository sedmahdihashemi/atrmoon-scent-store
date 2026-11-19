BEGIN;

ALTER TABLE public.order_items DROP COLUMN IF EXISTS no_bottle;
ALTER TABLE public.cart_items  DROP COLUMN IF EXISTS no_bottle;
ALTER TABLE public.product_variants DROP COLUMN IF EXISTS price_without_bottle;
DROP FUNCTION IF EXISTS public.compute_oil_price(integer, numeric, numeric, numeric);

-- Note: sync_variants_for_* keep referencing price_without_bottle; re-apply
-- bottles-autosync-01.sql to restore their pre-no_bottle versions if needed.

COMMIT;
