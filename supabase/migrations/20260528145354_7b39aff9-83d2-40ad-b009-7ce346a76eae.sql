CREATE OR REPLACE FUNCTION public.seller_wishlist_stats(p_store_id uuid)
RETURNS TABLE(product_id uuid, product_name text, wishlist_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name, COUNT(w.id)::bigint AS wishlist_count
  FROM public.products p
  LEFT JOIN public.wishlists w ON w.product_id = p.id
  WHERE p.store_id = p_store_id
    AND (
      EXISTS (SELECT 1 FROM public.stores s WHERE s.id = p.store_id AND s.seller_id = auth.uid())
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    )
  GROUP BY p.id, p.name
  ORDER BY wishlist_count DESC, p.name
$$;

GRANT EXECUTE ON FUNCTION public.seller_wishlist_stats(uuid) TO authenticated;