DROP POLICY IF EXISTS listings_owner_update ON public.listings;
CREATE POLICY listings_owner_update ON public.listings
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND (
    status = (SELECT l.status FROM public.listings l WHERE l.id = listings.id)
    OR status = 'sold'::listing_status
    OR status = 'pending'::listing_status
  )
);