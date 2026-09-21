-- =====================================================================
-- پرداخت بله — قدم ۲ از ۲: ستون‌ها، جدول رویدادهای پرداخت، و توابع
-- این فایل را فقط بعد از اجرای موفق bale-payment-01-enum.sql اجرا کنید.
--
-- کل فایل در یک تراکنش صریح (BEGIN/COMMIT) اجرا می‌شود: اگر هر خطی وسط
-- کار خطا بدهد، همه‌ی تغییرات این فایل خودکار برمی‌گردند و چیزی نصفه‌کاره
-- نمی‌ماند — صرف‌نظر از این‌که خودِ SQL Editor چطور دستورها را دسته‌بندی کند.
-- =====================================================================

BEGIN;

-- ============ ستون‌های پرداخت روی orders ============
-- payment_method برای سفارش‌های قدیمی/فعلی خودکار 'cod' می‌شود (رفتار قبلی).
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'cod'
    CHECK (payment_method IN ('cod','bale')),
  ADD COLUMN IF NOT EXISTS bale_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS paid_amount_rial NUMERIC(14,0),
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_expires_at TIMESTAMPTZ;

-- جلوگیری از ثبت دوباره‌ی همان شناسه‌ی تراکنش روی دو سفارش مختلف
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_bale_transaction_id_unique
  ON public.orders(bale_transaction_id) WHERE bale_transaction_id IS NOT NULL;

-- برای سرعت کار جاب انقضا
CREATE INDEX IF NOT EXISTS idx_orders_pending_bale_expiry
  ON public.orders(status, payment_method, payment_expires_at)
  WHERE status = 'pending_payment';

-- ============ جدول رویدادهای پرداخت (audit log) ============
-- هر پیام successful_payment که از بله می‌رسد، صرف‌نظر از این‌که با
-- موفقیت به یک سفارش وصل شود یا نه، این‌جا ثبت می‌شود تا هیچ تراکنشی
-- بی‌صدا گم نشود.
CREATE TABLE IF NOT EXISTS public.bale_payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  chat_id BIGINT,
  transaction_id TEXT,
  amount_rial NUMERIC(14,0),
  matched BOOLEAN NOT NULL,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bale_payment_events_order ON public.bale_payment_events(order_id);
CREATE INDEX IF NOT EXISTS idx_bale_payment_events_txn ON public.bale_payment_events(transaction_id);

ALTER TABLE public.bale_payment_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "bale_payment_events_admin_all" ON public.bale_payment_events
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT ALL ON public.bale_payment_events TO service_role;

-- دفاع دوم، جدا از RLS: حتی در سطح GRANT جدول هم anon هیچ دسترسی‌ای ندارد.
REVOKE ALL ON public.bale_payment_events FROM PUBLIC, anon;

-- ============ بازتعریف place_order با پشتیبانی از پرداخت بله ============
-- امضای قبلی (۹ پارامتر) حذف می‌شود چون پارامتر دهم اضافه شده؛
-- در غیر این صورت پستگرس دو تابع هم‌نام نگه می‌دارد و باعث خطای ابهام
-- (ambiguous function call) در فراخوانی‌های بعدی می‌شود.
DROP FUNCTION IF EXISTS public.place_order(uuid,text,text,text,text,text,text,text,text);

CREATE OR REPLACE FUNCTION public.place_order(
  p_cart_id uuid,
  p_session_id text,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_shipping_address text,
  p_city text,
  p_postal_code text,
  p_customer_note text,
  p_payment_method text DEFAULT 'cod'
)
RETURNS TABLE(order_id uuid, order_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cart record;
  v_uid uuid := auth.uid();
  v_store_id uuid;
  v_total numeric(12,2) := 0;
  v_order_id uuid;
  v_order_number text;
  v_item record;
  v_status public.order_status;
BEGIN
  IF p_payment_method NOT IN ('cod','bale') THEN
    RAISE EXCEPTION 'invalid_payment_method';
  END IF;

  SELECT * INTO v_cart FROM carts WHERE id = p_cart_id;
  IF v_cart IS NULL THEN RAISE EXCEPTION 'cart_not_found'; END IF;

  IF v_uid IS NOT NULL AND v_cart.customer_id IS NOT NULL AND v_cart.customer_id <> v_uid THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF v_cart.customer_id IS NULL AND (p_session_id IS NULL OR p_session_id <> v_cart.session_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_store_id := v_cart.store_id;
  IF v_store_id IS NULL THEN RAISE EXCEPTION 'empty_cart'; END IF;

  IF NOT EXISTS (SELECT 1 FROM cart_items WHERE cart_id = p_cart_id) THEN
    RAISE EXCEPTION 'empty_cart';
  END IF;

  FOR v_item IN
    SELECT ci.quantity, pv.volume_ml, pv.price, pv.discount_price, pv.id as variant_id,
           p.id as product_id, p.name as product_name, b.name as brand_name, bt.name as bottle_name
    FROM cart_items ci
    JOIN product_variants pv ON pv.id = ci.product_variant_id
    JOIN products p ON p.id = ci.product_id
    JOIN bottle_types bt ON bt.id = pv.bottle_type_id
    LEFT JOIN brands b ON b.id = p.brand_id
    WHERE ci.cart_id = p_cart_id
  LOOP
    PERFORM 1 FROM product_inventory
      WHERE product_id = v_item.product_id
        AND available_stock_ml >= (v_item.quantity * v_item.volume_ml)
      FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'insufficient_stock:%', v_item.product_name;
    END IF;
    v_total := v_total + (COALESCE(v_item.discount_price, v_item.price) * v_item.quantity);
  END LOOP;

  v_order_number := gen_order_number();
  v_status := CASE WHEN p_payment_method = 'bale'
                    THEN 'pending_payment'::public.order_status
                    ELSE 'pending_contact'::public.order_status END;

  INSERT INTO orders (
    customer_id, store_id, order_number, customer_name, customer_email,
    customer_phone, shipping_address, city, postal_code, total_amount,
    status, customer_note, payment_method, payment_expires_at
  ) VALUES (
    v_uid, v_store_id, v_order_number, p_customer_name, p_customer_email,
    p_customer_phone, p_shipping_address, p_city, p_postal_code, v_total,
    v_status, p_customer_note, p_payment_method,
    CASE WHEN p_payment_method = 'bale' THEN now() + interval '30 minutes' ELSE NULL END
  ) RETURNING id INTO v_order_id;

  FOR v_item IN
    SELECT ci.quantity, pv.volume_ml, pv.price, pv.discount_price, pv.id as variant_id,
           p.id as product_id, p.name as product_name, b.name as brand_name, bt.name as bottle_name
    FROM cart_items ci
    JOIN product_variants pv ON pv.id = ci.product_variant_id
    JOIN products p ON p.id = ci.product_id
    JOIN bottle_types bt ON bt.id = pv.bottle_type_id
    LEFT JOIN brands b ON b.id = p.brand_id
    WHERE ci.cart_id = p_cart_id
  LOOP
    INSERT INTO order_items (
      order_id, product_id, product_variant_id, product_name, brand_name,
      volume_ml, bottle_name, quantity, unit_price, total_price
    ) VALUES (
      v_order_id, v_item.product_id, v_item.variant_id, v_item.product_name, v_item.brand_name,
      v_item.volume_ml, v_item.bottle_name, v_item.quantity,
      COALESCE(v_item.discount_price, v_item.price),
      COALESCE(v_item.discount_price, v_item.price) * v_item.quantity
    );

    UPDATE product_inventory
       SET available_stock_ml = available_stock_ml - (v_item.quantity * v_item.volume_ml),
           reserved_stock_ml = reserved_stock_ml + (v_item.quantity * v_item.volume_ml),
           updated_at = now()
     WHERE product_id = v_item.product_id;
  END LOOP;

  BEGIN
    INSERT INTO order_status_history (order_id, status, note)
    VALUES (
      v_order_id,
      v_status,
      CASE WHEN p_payment_method = 'bale' THEN 'سفارش ثبت شد، در انتظار پرداخت' ELSE 'سفارش ثبت شد' END
    );
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

  DELETE FROM cart_items WHERE cart_id = p_cart_id;
  UPDATE carts SET store_id = NULL, updated_at = now() WHERE id = p_cart_id;

  -- NOTE: identical to the original function — this insert references an
  -- email_logs.payload column and a 'queued' status that don't exist in
  -- this schema, so it silently no-ops via the exception handler below.
  -- Left unchanged on purpose (see supabase/all-migrations.sql for the
  -- same note on the original migration).
  BEGIN
    INSERT INTO email_logs (order_id, recipient_email, subject, status, payload)
    SELECT v_order_id, s.support_email,
           'سفارش تازه — ' || v_order_number,
           'queued',
           jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number)
    FROM stores s WHERE s.id = v_store_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

  RETURN QUERY SELECT v_order_id, v_order_number;
END $$;

GRANT EXECUTE ON FUNCTION
  public.place_order(uuid,text,text,text,text,text,text,text,text,text)
  TO anon, authenticated;

-- ============ آزادکردن سفارش‌های «در انتظار پرداخت» منقضی‌شده ============
-- سفارش‌هایی که پرداختشان بیش از ۳۰ دقیقه طول بکشد، لغو می‌شوند و موجودی
-- رزروشده به انبار برمی‌گردد. توسط cron روی VPS یا هر place_order صدا
-- زده می‌شود (بخش کد، قدم بعد).
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

COMMIT;

-- =====================================================================
-- پایان
-- =====================================================================
