
CREATE POLICY "gallery_public_read" ON storage.objects FOR SELECT
USING (bucket_id = 'gallery');

CREATE POLICY "gallery_auth_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'gallery');

CREATE POLICY "gallery_auth_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'gallery');

CREATE POLICY "gallery_auth_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'gallery');
