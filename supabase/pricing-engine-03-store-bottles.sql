BEGIN;

-- ============================================================================
-- Optional pricing engine — step R1: store-owned bottles.
--
-- New direction (confirmed with the site owner): each shop defines its OWN
-- bottles (name, volume, photo, cost, profit), instead of picking from a
-- global admin list. So bottles become store-owned and private (cost/profit
-- are sensitive). Customer-facing bottle info (name, photo, volume) is
-- DENORMALIZED onto product_variants, so the public product page never needs
-- to read the private store_bottles table — same approach order_items already
-- uses for bottle_name.
--
-- This migration is additive and safe: it does NOT drop store_bottle_pricing
-- or the old global bottle_types yet (that cleanup happens in the next step,
-- alongside the new UI), and it migrates existing variants so nothing breaks.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.store_bottles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  volume_ml INTEGER NOT NULL CHECK (volume_ml > 0),
  photo_url TEXT,
  cost_toman NUMERIC(12, 2),
  profit_percent NUMERIC(6, 2) NOT NULL DEFAULT 0 CHECK (profit_percent >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_store_bottles_store ON public.store_bottles(store_id);

CREATE TRIGGER set_updated_at_store_bottles
  BEFORE UPDATE ON public.store_bottles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.store_bottles ENABLE ROW LEVEL SECURITY;

-- Private: the owning seller manages their bottles; admin all. No public read
-- (cost/profit are sensitive; customers see denormalized name/photo instead).
DROP POLICY IF EXISTS sb_seller_manage ON public.store_bottles;
CREATE POLICY sb_seller_manage ON public.store_bottles
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.seller_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.seller_id = auth.uid()));

DROP POLICY IF EXISTS sb_admin_all ON public.store_bottles;
CREATE POLICY sb_admin_all ON public.store_bottles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- product_variants now point at a store bottle, and carry denormalized bottle
-- display fields for the public product page. bottle_type_id becomes optional
-- (legacy global bottles).
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS store_bottle_id UUID REFERENCES public.store_bottles(id) ON DELETE RESTRICT;
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS bottle_name TEXT;
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS bottle_photo_url TEXT;
ALTER TABLE public.product_variants ALTER COLUMN bottle_type_id DROP NOT NULL;

-- Migrate existing data: for every global bottle type a store's variants use,
-- create a matching store-owned bottle (cost left blank for the seller to
-- fill), then repoint the variants and fill their denormalized fields.
INSERT INTO public.store_bottles (store_id, name, volume_ml, photo_url, cost_toman, profit_percent, is_active)
SELECT DISTINCT p.store_id, bt.name, bt.volume_ml, bt.image_url, NULL, 0, true
FROM public.product_variants v
JOIN public.products p ON p.id = v.product_id
JOIN public.bottle_types bt ON bt.id = v.bottle_type_id
WHERE v.bottle_type_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.store_bottles sb
    WHERE sb.store_id = p.store_id AND sb.name = bt.name AND sb.volume_ml = bt.volume_ml
  );

UPDATE public.product_variants v
SET store_bottle_id = sb.id,
    bottle_name = sb.name,
    bottle_photo_url = sb.photo_url
FROM public.products p, public.bottle_types bt, public.store_bottles sb
WHERE v.product_id = p.id
  AND v.bottle_type_id = bt.id
  AND sb.store_id = p.store_id
  AND sb.name = bt.name
  AND sb.volume_ml = bt.volume_ml
  AND v.store_bottle_id IS NULL;

COMMIT;
