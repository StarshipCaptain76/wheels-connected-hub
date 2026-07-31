DROP POLICY IF EXISTS garage_vehicles_read ON public.garage_vehicles;
DROP POLICY IF EXISTS garage_photos_read ON public.garage_vehicle_photos;

DROP POLICY IF EXISTS garage_insert_auth ON storage.objects;
DROP POLICY IF EXISTS garage_update_auth ON storage.objects;
DROP POLICY IF EXISTS garage_delete_auth ON storage.objects;

CREATE POLICY garage_insert_own ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'garage' AND (storage.foldername(name))[2] = auth.uid()::text);

CREATE POLICY garage_update_own ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'garage' AND (storage.foldername(name))[2] = auth.uid()::text)
WITH CHECK (bucket_id = 'garage' AND (storage.foldername(name))[2] = auth.uid()::text);

CREATE POLICY garage_delete_own ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'garage' AND (storage.foldername(name))[2] = auth.uid()::text);