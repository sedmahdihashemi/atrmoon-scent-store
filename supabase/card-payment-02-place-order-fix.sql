-- =====================================================================
-- اصلاح باگ: place_order هنوز 'card_transfer' را نمی‌شناخت
-- (فقط CHECK constraint جدول orders درست شده بود، نه خودِ تابع — دو
-- محل جدا و مستقل از هم بودند و یکی جا افتاد).
--
-- امضای تابع (تعداد و نوع پارامترها) عوض نشده، فقط بدنه؛ پس نیازی به
-- DROP FUNCTION نیست، CREATE OR REPLACE کافی است.
-- =====================================================================

BEGIN;

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
  IF p_payment_method NOT IN ('cod','bale','card_transfer') THEN
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
  v_status := CASE WHEN p_payment_method IN ('bale', 'card_transfer')
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
    CASE p_payment_method
      WHEN 'bale' THEN now() + interval '30 minutes'
      WHEN 'card_transfer' THEN now() + interval '3 days'
      ELSE NULL
    END
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
      CASE WHEN p_payment_method IN ('bale', 'card_transfer')
           THEN 'سفارش ثبت شد، در انتظار پرداخت'
           ELSE 'سفارش ثبت شد' END
    );
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

  DELETE FROM cart_items WHERE cart_id = p_cart_id;
  UPDATE carts SET store_id = NULL, updated_at = now() WHERE id = p_cart_id;

  -- NOTE: identical to the original function — this insert references an
  -- email_logs.payload column and a 'queued' status that don't exist in
  -- this schema, so it silently no-ops via the exception handler below.
  -- Left unchanged on purpose.
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

COMMIT;

-- =====================================================================
-- پایان
-- =====================================================================
