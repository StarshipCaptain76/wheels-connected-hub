DROP POLICY IF EXISTS "Anyone can read published newsletter pdfs" ON storage.objects;

CREATE POLICY "Anyone can read published newsletter pdfs"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'newsletters'
  AND EXISTS (
    SELECT 1 FROM public.newsletter_editions ne
    WHERE ne.is_published = true
      AND storage.objects.name IN (ne.pdf_path, ne.pdf_path_af)
  )
);