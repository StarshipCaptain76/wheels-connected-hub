ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_bio text,
  ADD COLUMN IF NOT EXISTS featured_photo_url text,
  ADD COLUMN IF NOT EXISTS featured_since timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_only_one_featured
  ON public.profiles ((true)) WHERE is_featured;

DROP POLICY IF EXISTS profiles_public_read_featured ON public.profiles;
CREATE POLICY profiles_public_read_featured
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (is_featured = true);

GRANT SELECT ON public.profiles TO anon;