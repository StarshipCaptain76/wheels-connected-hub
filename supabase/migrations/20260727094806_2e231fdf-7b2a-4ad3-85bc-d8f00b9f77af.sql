CREATE POLICY listings_bucket_public_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'listings');

CREATE POLICY listings_bucket_owner_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'listings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY listings_bucket_owner_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'listings' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'listings' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY listings_bucket_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'listings' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY listings_bucket_admin_manage ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'listings' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'listings' AND public.has_role(auth.uid(), 'admin'));