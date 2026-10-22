-- =====================================================================
-- Store Bale's "reference number" (provider_payment_charge_id) on the order
-- alongside the existing bale_transaction_id (the "tracking number" /
-- telegram_payment_charge_id). Both are shown on the official payment receipt
-- so the seller has a trustworthy record and can't be fooled by a fake slip.
-- Purely additive and nullable.
-- =====================================================================

BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS bale_reference_id TEXT;

COMMIT;
