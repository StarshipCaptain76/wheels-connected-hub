ALTER TABLE public.gallery_items ADD COLUMN IF NOT EXISTS category text;
CREATE INDEX IF NOT EXISTS gallery_items_category_idx ON public.gallery_items (category);