-- =====================================================================
-- Products: optional "stock badge" shown on the storefront (e.g. a
-- warehouse / ships-later tag). NULL = no badge (the normal case).
-- Purely additive and nullable; nothing reads it unless set.
-- =====================================================================

BEGIN;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock_badge TEXT;

COMMIT;
