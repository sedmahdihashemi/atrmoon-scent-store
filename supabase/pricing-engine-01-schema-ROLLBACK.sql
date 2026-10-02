BEGIN;

-- Reverses pricing-engine-01-schema.sql. Dropping the tables also drops their
-- triggers and policies. No data outside these two tables is touched.
DROP TABLE IF EXISTS public.product_pricing_settings;
DROP TABLE IF EXISTS public.store_pricing_settings;

COMMIT;
