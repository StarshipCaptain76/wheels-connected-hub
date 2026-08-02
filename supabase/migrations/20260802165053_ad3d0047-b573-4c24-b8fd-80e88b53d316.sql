-- GALLERY bucket reads
CREATE POLICY "gallery_public_read_published"
ON storage.objects FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'gallery'
  AND (
    EXISTS (
      SELECT 1 FROM public.gallery_items g
      WHERE g.is_published = true AND g.image_url LIKE '%' || objects.name
    )
    OR EXISTS (
      SELECT 1 FROM public.merch_items m
      WHERE m.is_active = true AND m.image_url LIKE '%' || objects.name
    )
  )
);

CREATE POLICY "gallery_admin_read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'gallery' AND public.has_role(auth.uid(), 'admin'));

-- GARAGE bucket reads
CREATE POLICY "garage_read_own"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'garage'
  AND (storage.foldername(name))[2] = (auth.uid())::text
);

CREATE POLICY "garage_members_read_visible"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'garage'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id::text = (storage.foldername(objects.name))[2]
      AND p.directory_visible = true
      AND p.membership_status IS DISTINCT FROM 'suspended'
  )
);

CREATE POLICY "garage_admin_read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'garage' AND public.has_role(auth.uid(), 'admin'));