
CREATE POLICY "notes_seller_insert" ON public.scent_notes FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'seller'::app_role));
