
-- 1) listing_contacts: drop the broad authenticated-read policy
DROP POLICY IF EXISTS listing_contacts_authenticated_read_approved ON public.listing_contacts;

-- 2) Newsletter: replace WITH CHECK (true) with basic constraints; still allows public subscribe
DROP POLICY IF EXISTS "Anyone can subscribe" ON public.newsletter_subscribers;
CREATE POLICY "Anyone can subscribe" ON public.newsletter_subscribers
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    unsubscribed_at IS NULL
    AND lang IN ('en','af')
    AND char_length(email::text) BETWEEN 3 AND 254
  );

-- 3) Storage: gallery bucket — only published items are publicly readable
DROP POLICY IF EXISTS gallery_public_read ON storage.objects;
CREATE POLICY gallery_public_read ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'gallery'
    AND EXISTS (
      SELECT 1 FROM public.gallery_items gi
      WHERE gi.is_published = true
        AND (gi.image_url = storage.objects.name OR gi.image_url LIKE '%/' || storage.objects.name)
    )
  );

-- 4) Storage: listings bucket — only photos on approved listings are publicly readable;
--    add owner SELECT so members can view their own pending/rejected uploads.
DROP POLICY IF EXISTS listings_bucket_public_read ON storage.objects;
CREATE POLICY listings_bucket_public_read ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'listings'
    AND EXISTS (
      SELECT 1
      FROM public.listing_photos lp
      JOIN public.listings l ON l.id = lp.listing_id
      WHERE lp.image_url = storage.objects.name
        AND l.status = 'approved'::listing_status
    )
  );

CREATE POLICY listings_bucket_owner_read ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'listings'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- 5) Storage: sponsors bucket — only active sponsors' logos are publicly readable;
--    add admin SELECT for admin sponsor management UI.
DROP POLICY IF EXISTS "Sponsor logos are readable" ON storage.objects;
CREATE POLICY "Sponsor logos are readable" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'sponsors'
    AND EXISTS (
      SELECT 1 FROM public.sponsors s
      WHERE s.is_active = true
        AND s.logo_path = storage.objects.name
    )
  );

CREATE POLICY sponsors_admin_read ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'sponsors'
    AND has_role(auth.uid(), 'admin'::app_role)
  );
