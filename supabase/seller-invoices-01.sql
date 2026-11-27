BEGIN;

-- ============================================================================
-- Seller invoice builder — schema.
--
-- A seller can compose a printable invoice (فاکتور) for a customer, either from
-- scratch (manual line items) or seeded from an existing order, then download
-- it as a PDF and share it. Invoices are informational documents: they move no
-- money and touch no inventory, so all math is display-only. Rows are store-
-- owned and private (RLS), mirroring store_bottles.
--
-- Also adds per-store invoice personalization (header name / contact / footer
-- note / whether to show the Atrmoon stamp) as a jsonb on stores, so each
-- عطاری can tailor how its invoices look without a second table.
-- ============================================================================

-- Per-store personalization for invoices (header line, contact, footer note…).
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS invoice_settings JSONB;

CREATE TABLE IF NOT EXISTS public.seller_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invoice_no TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  customer_note TEXT,
  -- line items: [{ title, qty, unit_price, note }]
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  discount_toman NUMERIC(14, 2) NOT NULL DEFAULT 0,
  shipping_toman NUMERIC(14, 2) NOT NULL DEFAULT 0,
  subtotal_toman NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_toman    NUMERIC(14, 2) NOT NULL DEFAULT 0,
  source_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seller_invoices_store ON public.seller_invoices(store_id, created_at DESC);

CREATE TRIGGER set_updated_at_seller_invoices
  BEFORE UPDATE ON public.seller_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.seller_invoices ENABLE ROW LEVEL SECURITY;

-- Private: the owning seller manages their own invoices; admin all.
DROP POLICY IF EXISTS si_seller_manage ON public.seller_invoices;
CREATE POLICY si_seller_manage ON public.seller_invoices
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.seller_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.seller_id = auth.uid()));

DROP POLICY IF EXISTS si_admin_all ON public.seller_invoices;
CREATE POLICY si_admin_all ON public.seller_invoices
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

COMMIT;
