CREATE POLICY "Anyone can read published newsletter pdfs"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'newsletters'
    AND EXISTS (
      SELECT 1 FROM public.newsletter_editions ne
      WHERE ne.pdf_path = storage.objects.name
        AND ne.is_published = true
    )
  );