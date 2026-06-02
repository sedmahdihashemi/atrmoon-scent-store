REVOKE SELECT (customer_id, order_id) ON public.reviews FROM anon;
REVOKE SELECT (customer_id, order_id) ON public.reviews FROM authenticated;

GRANT SELECT (id, product_id, rating, comment, status, created_at, updated_at) ON public.reviews TO anon;
GRANT SELECT (id, product_id, rating, comment, status, created_at, updated_at) ON public.reviews TO authenticated;

GRANT ALL ON public.reviews TO service_role;