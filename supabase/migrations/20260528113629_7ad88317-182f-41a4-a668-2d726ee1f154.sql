
DROP POLICY IF EXISTS carts_owner_all ON public.carts;
CREATE POLICY carts_owner_all ON public.carts
FOR ALL
USING (
  (customer_id IS NOT NULL AND customer_id = auth.uid())
  OR (customer_id IS NULL AND session_id IS NOT NULL
      AND session_id = nullif(current_setting('request.headers', true)::json->>'x-cart-session', ''))
)
WITH CHECK (
  (customer_id IS NOT NULL AND customer_id = auth.uid())
  OR (customer_id IS NULL AND session_id IS NOT NULL
      AND session_id = nullif(current_setting('request.headers', true)::json->>'x-cart-session', ''))
);

DROP POLICY IF EXISTS cart_items_owner_all ON public.cart_items;
CREATE POLICY cart_items_owner_all ON public.cart_items
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.carts c
  WHERE c.id = cart_items.cart_id
    AND ((c.customer_id IS NOT NULL AND c.customer_id = auth.uid())
      OR (c.customer_id IS NULL AND c.session_id IS NOT NULL
          AND c.session_id = nullif(current_setting('request.headers', true)::json->>'x-cart-session', '')))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.carts c
  WHERE c.id = cart_items.cart_id
    AND ((c.customer_id IS NOT NULL AND c.customer_id = auth.uid())
      OR (c.customer_id IS NULL AND c.session_id IS NOT NULL
          AND c.session_id = nullif(current_setting('request.headers', true)::json->>'x-cart-session', '')))
));

DROP POLICY IF EXISTS inv_public_read_avail ON public.product_inventory;
CREATE POLICY inv_public_read_avail ON public.product_inventory
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE p.id = product_inventory.product_id
      AND p.status = 'active'
      AND s.status = 'approved'
  )
);

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gen_order_number() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS product_images_public_read ON storage.objects;
CREATE POLICY product_images_seller_list ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
