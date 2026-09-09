UPDATE public.merch_items
SET image_url = split_part(replace(image_url, '/object/sign/', '/object/public/'), '?', 1)
WHERE image_url IS NOT NULL AND (image_url LIKE '%?%' OR image_url LIKE '%/object/sign/%');

UPDATE public.gallery_items
SET image_url = split_part(replace(image_url, '/object/sign/', '/object/public/'), '?', 1)
WHERE image_url IS NOT NULL AND (image_url LIKE '%?%' OR image_url LIKE '%/object/sign/%');

DROP POLICY IF EXISTS gallery_public_read_published ON storage.objects;
CREATE POLICY gallery_public_read_published ON storage.objects
FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'gallery'
  AND (
    EXISTS (
      SELECT 1 FROM public.gallery_items g
      WHERE g.is_published = true
        AND split_part(g.image_url, '?', 1) LIKE ('%' || objects.name)
    )
    OR EXISTS (
      SELECT 1 FROM public.merch_items m
      WHERE m.is_active = true
        AND split_part(m.image_url, '?', 1) LIKE ('%' || objects.name)
    )
  )
);