-- =====================================================================
-- Unified bottle management (formula stores).
--
-- Bottles become a store-level catalog: every active bottle is offered on
-- every formula-priced product automatically, at a live-computed price, and
-- the product_variants rows are kept in sync by triggers instead of by hand.
--   * activate/deactivate a bottle  → shown/hidden on ALL products at once
--   * change a bottle's cost/profit  → ALL products' prices recomputed
--   * add a new bottle               → appears on ALL products
--   * add/edit a product's oil cost   → that product gets all active bottles
-- The seller never ticks bottles per product again. product_variants stays the
-- runtime source of truth (cart, checkout, orders unchanged); triggers just
-- keep it mirroring the bottle catalog. discount_price is left untouched.
-- =====================================================================

BEGIN;

-- One variant per (product, bottle); lets the sync upsert cleanly and blocks
-- accidental duplicates. Partial: legacy variants with NULL store_bottle_id
-- (old bottle_types) are left alone.
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variants_product_bottle
  ON public.product_variants (product_id, store_bottle_id)
  WHERE store_bottle_id IS NOT NULL;

-- Shared formula (mirrors src/lib/pricing.ts): oil + bottle, rounded to 1000.
-- NULL when inputs are missing (manual-priced product) → caller skips it.
CREATE OR REPLACE FUNCTION public.compute_variant_price(
  p_volume_ml integer, p_concentration numeric, p_cost_per_gram numeric,
  p_oil_profit numeric, p_bottle_cost numeric, p_bottle_profit numeric
) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_cost_per_gram IS NULL OR p_bottle_cost IS NULL
      OR p_volume_ml IS NULL OR p_volume_ml <= 0
      OR p_concentration IS NULL OR p_concentration <= 0
    THEN NULL
    ELSE round((
      (p_volume_ml * p_concentration / 100.0 * p_cost_per_gram) * (1 + COALESCE(p_oil_profit, 0) / 100.0)
      + p_bottle_cost * (1 + COALESCE(p_bottle_profit, 0) / 100.0)
    ) / 1000.0) * 1000
  END
$$;

-- Sync every product in a bottle's store for that ONE bottle.
CREATE OR REPLACE FUNCTION public.sync_variants_for_bottle(p_bottle_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b record;
BEGIN
  SELECT * INTO b FROM store_bottles WHERE id = p_bottle_id;
  IF b IS NULL THEN RETURN; END IF;

  IF b.is_active THEN
    INSERT INTO product_variants (product_id, store_bottle_id, bottle_type_id,
                                  volume_ml, bottle_name, bottle_photo_url, price, status)
    SELECT p.id, b.id, NULL, b.volume_ml, b.name, b.photo_url,
           compute_variant_price(b.volume_ml, pps.concentration_percent, pps.cost_per_gram_toman,
                                 pps.oil_profit_percent, b.cost_toman, b.profit_percent),
           'active'
    FROM products p
    JOIN product_pricing_settings pps ON pps.product_id = p.id
    WHERE p.store_id = b.store_id
      AND compute_variant_price(b.volume_ml, pps.concentration_percent, pps.cost_per_gram_toman,
                                pps.oil_profit_percent, b.cost_toman, b.profit_percent) IS NOT NULL
    ON CONFLICT (product_id, store_bottle_id) WHERE store_bottle_id IS NOT NULL
    DO UPDATE SET volume_ml = EXCLUDED.volume_ml, bottle_name = EXCLUDED.bottle_name,
                  bottle_photo_url = EXCLUDED.bottle_photo_url, price = EXCLUDED.price,
                  status = 'active', updated_at = now();
  ELSE
    UPDATE product_variants SET status = 'inactive', updated_at = now()
    WHERE store_bottle_id = b.id AND status <> 'inactive';
  END IF;
END $$;

-- Sync every active bottle for ONE product (new product / oil cost changed).
CREATE OR REPLACE FUNCTION public.sync_variants_for_product(p_product_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pr record; pps record;
BEGIN
  SELECT * INTO pr FROM products WHERE id = p_product_id;
  IF pr IS NULL THEN RETURN; END IF;
  SELECT * INTO pps FROM product_pricing_settings WHERE product_id = p_product_id;
  IF pps IS NULL THEN RETURN; END IF;

  INSERT INTO product_variants (product_id, store_bottle_id, bottle_type_id,
                                volume_ml, bottle_name, bottle_photo_url, price, status)
  SELECT pr.id, b.id, NULL, b.volume_ml, b.name, b.photo_url,
         compute_variant_price(b.volume_ml, pps.concentration_percent, pps.cost_per_gram_toman,
                               pps.oil_profit_percent, b.cost_toman, b.profit_percent),
         'active'
  FROM store_bottles b
  WHERE b.store_id = pr.store_id AND b.is_active
    AND compute_variant_price(b.volume_ml, pps.concentration_percent, pps.cost_per_gram_toman,
                              pps.oil_profit_percent, b.cost_toman, b.profit_percent) IS NOT NULL
  ON CONFLICT (product_id, store_bottle_id) WHERE store_bottle_id IS NOT NULL
  DO UPDATE SET volume_ml = EXCLUDED.volume_ml, bottle_name = EXCLUDED.bottle_name,
                bottle_photo_url = EXCLUDED.bottle_photo_url, price = EXCLUDED.price,
                status = 'active', updated_at = now();
END $$;

-- Triggers
CREATE OR REPLACE FUNCTION public.trg_sync_bottle_variants() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN PERFORM public.sync_variants_for_bottle(NEW.id); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS sync_bottle_variants ON public.store_bottles;
CREATE TRIGGER sync_bottle_variants
  AFTER INSERT OR UPDATE OF is_active, cost_toman, profit_percent, volume_ml, name, photo_url
  ON public.store_bottles FOR EACH ROW EXECUTE FUNCTION public.trg_sync_bottle_variants();

CREATE OR REPLACE FUNCTION public.trg_sync_product_variants() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN PERFORM public.sync_variants_for_product(NEW.product_id); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS sync_product_variants ON public.product_pricing_settings;
CREATE TRIGGER sync_product_variants
  AFTER INSERT OR UPDATE OF cost_per_gram_toman, concentration_percent, oil_profit_percent
  ON public.product_pricing_settings FOR EACH ROW EXECUTE FUNCTION public.trg_sync_product_variants();

COMMIT;
