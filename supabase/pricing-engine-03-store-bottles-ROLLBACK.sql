BEGIN;

-- Reverses pricing-engine-03-store-bottles.sql. Drops the new columns and the
-- store_bottles table. NOTE: this does NOT restore bottle_type_id to NOT NULL
-- automatically, because migrated variants may legitimately rely on
-- store_bottle_id; if you truly need the old NOT NULL back, ensure every
-- variant has a bottle_type_id first, then re-add the constraint manually.
ALTER TABLE public.product_variants DROP COLUMN IF EXISTS store_bottle_id;
ALTER TABLE public.product_variants DROP COLUMN IF EXISTS bottle_name;
ALTER TABLE public.product_variants DROP COLUMN IF EXISTS bottle_photo_url;

DROP TABLE IF EXISTS public.store_bottles;

COMMIT;
