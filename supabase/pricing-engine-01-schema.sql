BEGIN;

-- ============================================================================
-- Optional pricing engine — step 1: store + product pricing settings.
--
-- These are PRIVATE helper settings that only assist filling the existing
-- product_variants.price field. Nothing else (cart, place_order, invoice,
-- commission) reads them. Cost/margin data is sensitive, and products has a
-- PUBLIC read policy, so the product-level fields live in a SEPARATE table
-- (product_pricing_settings) with seller/admin-only RLS instead of as columns
-- on products — otherwise raw costs would leak to the public API.
--
-- Decisions (confirmed with the store owner):
--   * cost_per_gram is entered directly in Toman (USD rate does NOT enter the
--     oil formula; usd_rate here is informational for now).
--   * bottle cost/profit is per-store (added in a later step).
--   * the formula writes only to price; discount_price stays manual.
--   * final price rounds to the nearest 1000 Toman (applied in compute step).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.store_pricing_settings (
  store_id UUID PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  pricing_mode TEXT NOT NULL DEFAULT 'manual' CHECK (pricing_mode IN ('manual', 'formula')),
  usd_rate_toman NUMERIC(14, 2),
  usd_auto_update_enabled BOOLEAN NOT NULL DEFAULT false,
  usd_update_day_of_week SMALLINT CHECK (usd_update_day_of_week BETWEEN 0 AND 6),
  usd_auto_update_max_change_percent NUMERIC(5, 2) NOT NULL DEFAULT 15
    CHECK (usd_auto_update_max_change_percent >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-product raw-material inputs. Only meaningful when the store is in
-- 'formula' mode; ignored entirely in 'manual' mode.
CREATE TABLE IF NOT EXISTS public.product_pricing_settings (
  product_id UUID PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  cost_per_gram_toman NUMERIC(12, 2),
  concentration_percent NUMERIC(5, 2) NOT NULL DEFAULT 50
    CHECK (concentration_percent > 0 AND concentration_percent <= 100),
  oil_profit_percent NUMERIC(6, 2) NOT NULL DEFAULT 0
    CHECK (oil_profit_percent >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at_store_pricing_settings
  BEFORE UPDATE ON public.store_pricing_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_product_pricing_settings
  BEFORE UPDATE ON public.product_pricing_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.store_pricing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_pricing_settings ENABLE ROW LEVEL SECURITY;

-- store_pricing_settings: the owning seller manages their row; admin all.
-- No public read — these are internal pricing controls.
DROP POLICY IF EXISTS sps_seller_manage ON public.store_pricing_settings;
CREATE POLICY sps_seller_manage ON public.store_pricing_settings
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.seller_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.seller_id = auth.uid()));

DROP POLICY IF EXISTS sps_admin_all ON public.store_pricing_settings;
CREATE POLICY sps_admin_all ON public.store_pricing_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- product_pricing_settings: seller of the product's store manages; admin all.
-- No public read — keeps raw cost/margin private.
DROP POLICY IF EXISTS pps_seller_manage ON public.product_pricing_settings;
CREATE POLICY pps_seller_manage ON public.product_pricing_settings
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE p.id = product_id AND s.seller_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE p.id = product_id AND s.seller_id = auth.uid()
  ));

DROP POLICY IF EXISTS pps_admin_all ON public.product_pricing_settings;
CREATE POLICY pps_admin_all ON public.product_pricing_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- TODO (known limitation, to be addressed in a later, separate project):
-- Inventory is tracked in available_stock_ml (finished product volume), NOT in
-- grams of raw oil consumed. The pricing formula uses grams of oil, but stock
-- deduction still works on ml. Reconciling oil-grams inventory is out of scope
-- for the pricing engine and intentionally deferred.

COMMIT;
