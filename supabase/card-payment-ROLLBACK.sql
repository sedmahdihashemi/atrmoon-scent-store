-- =====================================================================
-- بازگرداندن migration پرداخت کارت‌به‌کارت (card-payment-01-schema.sql)
-- =====================================================================

BEGIN;

-- برگرداندن تابع انقضا به حالت فقط-بله
CREATE OR REPLACE FUNCTION public.expire_pending_bale_orders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_order RECORD;
  v_item RECORD;
BEGIN
  FOR v_order IN
    SELECT id FROM orders
    WHERE status = 'pending_payment'
      AND payment_method = 'bale'
      AND payment_expires_at IS NOT NULL
      AND payment_expires_at < now()
    FOR UPDATE SKIP LOCKED
  LOOP
    FOR v_item IN
      SELECT product_id, quantity, volume_ml FROM order_items WHERE order_id = v_order.id
    LOOP
      UPDATE product_inventory
         SET available_stock_ml = available_stock_ml + (v_item.quantity * v_item.volume_ml),
             reserved_stock_ml = GREATEST(0, reserved_stock_ml - (v_item.quantity * v_item.volume_ml)),
             updated_at = now()
       WHERE product_id = v_item.product_id;
    END LOOP;

    UPDATE orders SET status = 'cancelled', updated_at = now() WHERE id = v_order.id;

    BEGIN
      INSERT INTO order_status_history (order_id, old_status, new_status, note)
      VALUES (v_order.id, 'pending_payment', 'cancelled', 'پرداخت در مهلت مقرر (۳۰ دقیقه) انجام نشد و سفارش خودکار لغو شد');
    EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION public.expire_pending_bale_orders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_pending_bale_orders() TO service_role;

-- برگرداندن CHECK constraint به فقط دو مقدار قبلی
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'public.orders'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%payment_method%';
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('cod', 'bale'));

-- حذف ستون‌های کارت‌به‌کارت از orders
ALTER TABLE public.orders
  DROP COLUMN IF EXISTS card_transfer_receipt_path,
  DROP COLUMN IF EXISTS card_transfer_note,
  DROP COLUMN IF EXISTS card_transfer_submitted_at,
  DROP COLUMN IF EXISTS card_transfer_reviewed_at,
  DROP COLUMN IF EXISTS card_transfer_reviewed_by,
  DROP COLUMN IF EXISTS card_transfer_rejection_reason,
  DROP COLUMN IF EXISTS card_transfer_attempt_count;

-- حذف ستون‌های شماره کارت از stores
ALTER TABLE public.stores
  DROP COLUMN IF EXISTS card_number,
  DROP COLUMN IF EXISTS card_holder_name;

COMMIT;

-- =====================================================================
-- عمداً در این فایل نیست: حذف bucket «payment-receipts».
-- اگر تا این لحظه رسیدی در آن آپلود شده باشد، حذف bucket آن فایل‌ها را
-- هم پاک می‌کند — این یک تصمیم مخرب و جداگانه است. اگر واقعاً می‌خواهید
-- bucket را هم حذف کنید (فقط بعد از اطمینان از خالی‌بودنش)، این را
-- جدا و دستی اجرا کنید:
--   delete from storage.objects where bucket_id = 'payment-receipts';
--   delete from storage.buckets where id = 'payment-receipts';
-- =====================================================================
