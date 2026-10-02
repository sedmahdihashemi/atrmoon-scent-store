BEGIN;

-- Reverses pricing-engine-02-bottle-pricing.sql. Dropping the table also drops
-- its trigger and policies. bottle_types itself is untouched.
DROP TABLE IF EXISTS public.store_bottle_pricing;

COMMIT;
