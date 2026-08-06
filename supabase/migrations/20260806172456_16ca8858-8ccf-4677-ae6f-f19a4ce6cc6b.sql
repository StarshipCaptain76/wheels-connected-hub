CREATE POLICY "listings_bucket_listing_owner_read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'listings'
  AND EXISTS (
    SELECT 1 FROM public.listing_photos lp
    JOIN public.listings l ON l.id = lp.listing_id
    WHERE lp.image_url = storage.objects.name AND l.user_id = auth.uid()
  )
);