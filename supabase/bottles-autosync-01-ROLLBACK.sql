BEGIN;

DROP TRIGGER IF EXISTS sync_product_variants ON public.product_pricing_settings;
DROP TRIGGER IF EXISTS sync_bottle_variants ON public.store_bottles;
DROP FUNCTION IF EXISTS public.trg_sync_product_variants();
DROP FUNCTION IF EXISTS public.trg_sync_bottle_variants();
DROP FUNCTION IF EXISTS public.sync_variants_for_product(uuid);
DROP FUNCTION IF EXISTS public.sync_variants_for_bottle(uuid);
DROP FUNCTION IF EXISTS public.compute_variant_price(integer, numeric, numeric, numeric, numeric, numeric);
DROP INDEX IF EXISTS public.idx_product_variants_product_bottle;

COMMIT;
