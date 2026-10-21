BEGIN;

DROP TABLE IF EXISTS public.wholesale_memberships;
ALTER TABLE public.store_pricing_settings DROP COLUMN IF EXISTS wholesale_oil_profit_percent;

COMMIT;
