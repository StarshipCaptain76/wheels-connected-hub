-- Smaller thumbnails for the public gallery grid.
-- Full image_url is only loaded when the user opens the lightbox.
ALTER TABLE public.gallery_items
  ADD COLUMN IF NOT EXISTS thumb_url text;

COMMENT ON COLUMN public.gallery_items.thumb_url IS
  'Optional smaller (~480px) version of image_url for grid display. Falls back to image_url when null.';
