CREATE POLICY "gallery_public_read_event_images"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'gallery'
  AND EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.is_published = true
      AND (
        e.cover_url LIKE ('%' || objects.name)
        OR e.hero_image_url LIKE ('%' || objects.name)
      )
  )
);