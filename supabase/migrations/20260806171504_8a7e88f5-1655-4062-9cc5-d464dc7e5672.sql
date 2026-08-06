CREATE POLICY listings_admin_insert ON public.listings
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));