CREATE POLICY "Admins manage newsletter pdfs"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'newsletters' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'newsletters' AND public.has_role(auth.uid(), 'admin'));