BEGIN;

-- Rollback for seller-invoices-01.sql
DROP POLICY IF EXISTS si_admin_all ON public.seller_invoices;
DROP POLICY IF EXISTS si_seller_manage ON public.seller_invoices;
DROP TRIGGER IF EXISTS set_updated_at_seller_invoices ON public.seller_invoices;
DROP TABLE IF EXISTS public.seller_invoices;

ALTER TABLE public.stores DROP COLUMN IF EXISTS invoice_settings;

COMMIT;
