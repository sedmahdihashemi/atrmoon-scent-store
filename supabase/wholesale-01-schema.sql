BEGIN;

-- ============================================================================
-- Wholesale buyers — step 1: membership + per-store wholesale oil profit.
--
-- Concept (confirmed with the store owner): a wholesale buyer is NOT given a
-- discount off retail — they are priced with a LOWER oil profit %. Retail oil
-- profit might be 100%; an approved wholesale buyer might get 20% oil profit.
-- The wholesale price is the SAME formula with that lower oil-profit, computed
-- server-side only (never exposed publicly, never trusted from the client).
--
-- Per-store default lives on store_pricing_settings; each membership may carry
-- its own override (a specific buyer can get a different rate). Approval is by
-- the seller only. No minimum order — approved means wholesale pricing always.
-- ============================================================================

-- Store-wide default wholesale oil profit (e.g. 20 = 20%). NULL = the store
-- hasn't set a wholesale rate yet, so approved buyers fall back to retail until
-- it (or a per-buyer rate) is set.
ALTER TABLE public.store_pricing_settings
  ADD COLUMN IF NOT EXISTS wholesale_oil_profit_percent NUMERIC(6, 2)
    CHECK (wholesale_oil_profit_percent IS NULL OR wholesale_oil_profit_percent >= 0);

CREATE TABLE IF NOT EXISTS public.wholesale_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  -- optional per-buyer override of the store's wholesale oil profit %
  oil_profit_percent NUMERIC(6, 2) CHECK (oil_profit_percent IS NULL OR oil_profit_percent >= 0),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, customer_id)
);
CREATE INDEX IF NOT EXISTS idx_wholesale_memberships_store ON public.wholesale_memberships(store_id);
CREATE INDEX IF NOT EXISTS idx_wholesale_memberships_customer ON public.wholesale_memberships(customer_id);

CREATE TRIGGER set_updated_at_wholesale_memberships
  BEFORE UPDATE ON public.wholesale_memberships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.wholesale_memberships ENABLE ROW LEVEL SECURITY;

-- Customer: can see their own memberships, and create their own request. They
-- cannot set the rate or the status beyond "pending" (no self-approval).
DROP POLICY IF EXISTS wm_customer_select ON public.wholesale_memberships;
CREATE POLICY wm_customer_select ON public.wholesale_memberships
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid());

DROP POLICY IF EXISTS wm_customer_request ON public.wholesale_memberships;
CREATE POLICY wm_customer_request ON public.wholesale_memberships
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid() AND status = 'pending' AND oil_profit_percent IS NULL);

-- Seller of the store: full manage (approve/reject, set per-buyer rate).
DROP POLICY IF EXISTS wm_seller_manage ON public.wholesale_memberships;
CREATE POLICY wm_seller_manage ON public.wholesale_memberships
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.seller_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.seller_id = auth.uid()));

DROP POLICY IF EXISTS wm_admin_all ON public.wholesale_memberships;
CREATE POLICY wm_admin_all ON public.wholesale_memberships
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

COMMIT;
