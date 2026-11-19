-- =====================================================================
-- "Without bottle" option: a customer who brings their own bottle pays only
-- for the oil. We store an oil-only price on each variant (price_without_bottle)
-- kept in sync by the same bottle triggers, and a per-line no_bottle flag on
-- cart_items / order_items. The bottle's contribution = price - price_without_bottle
-- (both public), so the client can show the discount without seeing bottle cost.
-- Run AFTER bottles-autosync-01.sql (it reuses that migration's triggers).
-- =====================================================================

BEGIN;

ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS price_without_bottle NUMERIC(12, 2);
ALTER TABLE public.cart_items  ADD COLUMN IF NOT EXISTS no_bottle BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS no_bottle BOOLEAN NOT NULL DEFAULT false;

-- Oil-only price (no bottle), rounded to 1000. NULL when inputs missing.
CREATE OR REPLACE FUNCTION public.compute_oil_price(
  p_volume_ml integer, p_concentration numeric, p_cost_per_gram numeric, p_oil_profit numeric
) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_cost_per_gram IS NULL OR p_volume_ml IS NULL OR p_volume_ml <= 0
      OR p_concentration IS NULL OR p_concentration <= 0
    THEN NULL
    ELSE round((p_volume_ml * p_concentration / 100.0 * p_cost_per_gram)
               * (1 + COALESCE(p_oil_profit, 0) / 100.0) / 1000.0) * 1000
  END
$$;

-- Redefine the two sync functions to ALSO maintain price_without_bottle.
CREATE OR REPLACE FUNCTION public.sync_variants_for_bottle(p_bottle_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b record;
BEGIN
  SELECT * INTO b FROM store_bottles WHERE id = p_bottle_id;
  IF b IS NULL THEN RETURN; END IF;

  IF b.is_active THEN
    INSERT INTO product_variants (product_id, store_bottle_id, bottle_type_id,
                                  volume_ml, bottle_name, bottle_photo_url, price, price_without_bottle, status)
    SELECT p.id, b.id, NULL, b.volume_ml, b.name, b.photo_url,
           compute_variant_price(b.volume_ml, pps.concentration_percent, pps.cost_per_gram_toman,
                                 pps.oil_profit_percent, b.cost_toman, b.profit_percent),
           compute_oil_price(b.volume_ml, pps.concentration_percent, pps.cost_per_gram_toman, pps.oil_profit_percent),
           'active'
    FROM products p
    JOIN product_pricing_settings pps ON pps.product_id = p.id
    WHERE p.store_id = b.store_id
      AND compute_variant_price(b.volume_ml, pps.concentration_percent, pps.cost_per_gram_toman,
                                pps.oil_profit_percent, b.cost_toman, b.profit_percent) IS NOT NULL
    ON CONFLICT (product_id, store_bottle_id) WHERE store_bottle_id IS NOT NULL
    DO UPDATE SET volume_ml = EXCLUDED.volume_ml, bottle_name = EXCLUDED.bottle_name,
                  bottle_photo_url = EXCLUDED.bottle_photo_url, price = EXCLUDED.price,
                  price_without_bottle = EXCLUDED.price_without_bottle,
                  status = 'active', updated_at = now();
  ELSE
    UPDATE product_variants SET status = 'inactive', updated_at = now()
    WHERE store_bottle_id = b.id AND status <> 'inactive';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sync_variants_for_product(p_product_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pr record; pps record;
BEGIN
  SELECT * INTO pr FROM products WHERE id = p_product_id;
  IF pr IS NULL THEN RETURN; END IF;
  SELECT * INTO pps FROM product_pricing_settings WHERE product_id = p_product_id;
  IF pps IS NULL THEN RETURN; END IF;

  INSERT INTO product_variants (product_id, store_bottle_id, bottle_type_id,
                                volume_ml, bottle_name, bottle_photo_url, price, price_without_bottle, status)
  SELECT pr.id, b.id, NULL, b.volume_ml, b.name, b.photo_url,
         compute_variant_price(b.volume_ml, pps.concentration_percent, pps.cost_per_gram_toman,
                               pps.oil_profit_percent, b.cost_toman, b.profit_percent),
         compute_oil_price(b.volume_ml, pps.concentration_percent, pps.cost_per_gram_toman, pps.oil_profit_percent),
         'active'
  FROM store_bottles b
  WHERE b.store_id = pr.store_id AND b.is_active
    AND compute_variant_price(b.volume_ml, pps.concentration_percent, pps.cost_per_gram_toman,
                              pps.oil_profit_percent, b.cost_toman, b.profit_percent) IS NOT NULL
  ON CONFLICT (product_id, store_bottle_id) WHERE store_bottle_id IS NOT NULL
  DO UPDATE SET volume_ml = EXCLUDED.volume_ml, bottle_name = EXCLUDED.bottle_name,
                bottle_photo_url = EXCLUDED.bottle_photo_url, price = EXCLUDED.price,
                price_without_bottle = EXCLUDED.price_without_bottle,
                status = 'active', updated_at = now();
END $$;

-- Backfill existing variants' oil-only price.
UPDATE public.product_variants pv
SET price_without_bottle = compute_oil_price(pv.volume_ml, pps.concentration_percent,
                                             pps.cost_per_gram_toman, pps.oil_profit_percent)
FROM public.product_pricing_settings pps
WHERE pv.product_id = pps.product_id AND pv.store_bottle_id IS NOT NULL;

COMMIT;
