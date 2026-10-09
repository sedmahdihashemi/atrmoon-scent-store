BEGIN;

-- Recreates store_bottle_pricing as an EMPTY table (original shape + RLS).
-- The data that was in it is NOT restored.
CREATE TABLE IF NOT EXISTS public.store_bottle_pricing (
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  bottle_type_id UUID NOT NULL REFERENCES public.bottle_types(id) ON DELETE CASCADE,
  cost_toman NUMERIC(12, 2),
  profit_percent NUMERIC(6, 2) NOT NULL DEFAULT 0 CHECK (profit_percent >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, bottle_type_id)
);

CREATE TRIGGER set_updated_at_store_bottle_pricing
  BEFORE UPDATE ON public.store_bottle_pricing
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.store_bottle_pricing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sbp_seller_manage ON public.store_bottle_pricing;
CREATE POLICY sbp_seller_manage ON public.store_bottle_pricing
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.seller_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.seller_id = auth.uid()));

DROP POLICY IF EXISTS sbp_admin_all ON public.store_bottle_pricing;
CREATE POLICY sbp_admin_all ON public.store_bottle_pricing
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

COMMIT;
