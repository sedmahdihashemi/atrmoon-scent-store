-- =====================================================================
-- پرداخت کارت‌به‌کارت — قدم ۱: ستون‌ها، bucket خصوصی، تعمیم تابع انقضا
-- برخلاف پرداخت بله، این‌بار enum جدیدی لازم نیست (فقط CHECK constraint
-- ستون payment_method عوض می‌شود)، پس همه‌چیز در یک تراکنش جا می‌شود.
-- =====================================================================

BEGIN;

-- ============ شماره کارت فروشگاه ============
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS card_number TEXT,
  ADD COLUMN IF NOT EXISTS card_holder_name TEXT;

-- ============ ستون‌های کارت‌به‌کارت روی orders ============
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS card_transfer_receipt_path TEXT,
  ADD COLUMN IF NOT EXISTS card_transfer_note TEXT,
  ADD COLUMN IF NOT EXISTS card_transfer_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS card_transfer_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS card_transfer_reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS card_transfer_rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS card_transfer_attempt_count INTEGER NOT NULL DEFAULT 0;

-- اجازه‌دادن مقدار سوم به payment_method. چون این constraint موقع ساختش
-- اسم‌گذاری صریح نشده بود (Postgres خودش اسم می‌گذارد)، به‌جای حدس‌زدن
-- اسمش، پیدا و حذفش می‌کنیم بر اساس محتوایش.
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
  CHECK (payment_method IN ('cod', 'bale', 'card_transfer'));

-- ============ Bucket خصوصی برای رسید پرداخت ============
-- public=false عمداً — بر خلاف product-images. هیچ policy برای anon یا
-- authenticated اضافه نمی‌شود؛ همه‌ی دسترسی‌ها (آپلود توسط مشتری مهمان،
-- خواندن توسط فروشنده) فقط از طریق کد سرور با کلید service_role انجام
-- می‌شود (که RLS را دور می‌زند)، دقیقاً چون مهمان‌ها auth.uid() ندارند.
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-receipts', 'payment-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- ============ تعمیم تابع انقضا ============
-- تنها تغییر: فیلتر payment_method از 'bale' به هر دو روش باز می‌شود.
-- زمان‌بندی (۳۰ دقیقه برای بله در برابر ۳ روز برای کارت‌به‌کارت) از قبل
-- توسط ستون payment_expires_at تعیین می‌شود (که موقع ساخت سفارش پر
-- می‌شود)، پس این تغییر رفتار زمانی سفارش‌های بله را عوض نمی‌کند.
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
      AND payment_method IN ('bale', 'card_transfer')
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
      VALUES (
        v_order.id, 'pending_payment', 'cancelled',
        'پرداخت در مهلت مقرر انجام نشد و سفارش خودکار لغو شد'
      );
    EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION public.expire_pending_bale_orders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_pending_bale_orders() TO service_role;

COMMIT;

-- =====================================================================
-- پایان
-- =====================================================================
