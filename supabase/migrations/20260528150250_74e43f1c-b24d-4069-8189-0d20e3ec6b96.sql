CREATE OR REPLACE FUNCTION public.top_selling_products(p_limit integer DEFAULT 8)
RETURNS TABLE (
  id uuid,
  slug text,
  name text,
  main_image_url text,
  store_id uuid,
  store_name text,
  brand_name text,
  min_price numeric,
  cheapest_variant_id uuid,
  sold_qty bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH sales AS (
    SELECT oi.product_id, SUM(oi.quantity)::bigint AS sold_qty
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE oi.product_id IS NOT NULL
    GROUP BY oi.product_id
  ),
  cheap AS (
    SELECT DISTINCT ON (pv.product_id)
      pv.product_id, pv.id AS variant_id,
      COALESCE(pv.discount_price, pv.price) AS price
    FROM product_variants pv
    WHERE pv.status = 'active'
    ORDER BY pv.product_id, COALESCE(pv.discount_price, pv.price) ASC
  )
  SELECT p.id, p.slug, p.name, p.main_image_url, p.store_id,
         s.store_name, b.name AS brand_name,
         c.price AS min_price, c.variant_id AS cheapest_variant_id,
         COALESCE(sa.sold_qty, 0) AS sold_qty
  FROM products p
  LEFT JOIN sales sa ON sa.product_id = p.id
  LEFT JOIN cheap c ON c.product_id = p.id
  LEFT JOIN stores s ON s.id = p.store_id
  LEFT JOIN brands b ON b.id = p.brand_id
  WHERE p.status = 'active' AND c.variant_id IS NOT NULL
  ORDER BY COALESCE(sa.sold_qty, 0) DESC, p.created_at DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.top_selling_products(integer) TO anon, authenticated, service_role;