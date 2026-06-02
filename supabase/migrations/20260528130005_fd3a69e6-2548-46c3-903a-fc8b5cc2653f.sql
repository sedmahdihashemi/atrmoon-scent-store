-- 1) Fix product_scent_notes public read: only for active products in approved stores
DROP POLICY IF EXISTS psn_public_read ON public.product_scent_notes;

CREATE POLICY psn_public_read
ON public.product_scent_notes
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE p.id = product_scent_notes.product_id
      AND p.status = 'active'::product_status
      AND s.status = 'approved'::store_status
  )
);

-- 2) Restrict sensitive seller contact columns on stores from anonymous users.
-- RLS is row-level only; use column-level GRANTs to hide sensitive columns from anon.
REVOKE SELECT ON public.stores FROM anon;

GRANT SELECT (
  id,
  store_name,
  slug,
  description,
  logo_url,
  city,
  instagram_url,
  status,
  created_at,
  updated_at
) ON public.stores TO anon;

-- Authenticated users keep full read access (RLS still applies: approved stores OR own store OR admin).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;