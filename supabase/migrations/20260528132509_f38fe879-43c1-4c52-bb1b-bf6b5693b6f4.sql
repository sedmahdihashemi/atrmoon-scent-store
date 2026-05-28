
DROP POLICY IF EXISTS inv_public_read_avail ON public.product_inventory;

REVOKE SELECT ON public.product_inventory FROM anon;
GRANT SELECT (product_id, available_stock_ml) ON public.product_inventory TO anon;

CREATE POLICY inv_public_read_avail ON public.product_inventory
FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE p.id = product_inventory.product_id
      AND p.status = 'active'::product_status
      AND s.status = 'approved'::store_status
  )
);

ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
