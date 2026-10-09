BEGIN;

-- Optional pricing engine — step R2 cleanup: drop the now-obsolete
-- store_bottle_pricing table. It was superseded by store_bottles (bottles are
-- now fully store-owned, carrying their own cost/profit). Nothing reads it any
-- more. The rollback recreates an EMPTY table with the same shape (data is not
-- restored).
DROP TABLE IF EXISTS public.store_bottle_pricing;

COMMIT;
