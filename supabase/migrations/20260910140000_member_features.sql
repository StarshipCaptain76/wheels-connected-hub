-- Editorial "New Member Feature" stories. Idempotent.
-- Public reads are limited to published rows; admins manage all.

CREATE TABLE IF NOT EXISTS public.member_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  slug text,
  headline_en text NOT NULL DEFAULT '',
  headline_af text,
  deck_en text,
  deck_af text,
  body_en text NOT NULL DEFAULT '',
  body_af text,
  cover_url text,
  published boolean NOT NULL DEFAULT false,
  show_on_home boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.member_feature_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id uuid NOT NULL REFERENCES public.member_features(id) ON DELETE CASCADE,
  url text NOT NULL,
  caption_en text,
  caption_af text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS member_features_one_home
  ON public.member_features (show_on_home)
  WHERE show_on_home;

CREATE UNIQUE INDEX IF NOT EXISTS member_features_slug_uniq
  ON public.member_features (slug)
  WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS member_features_member_user_id_idx
  ON public.member_features (member_user_id);

CREATE INDEX IF NOT EXISTS member_feature_photos_feature_id_idx
  ON public.member_feature_photos (feature_id, sort_order);

ALTER TABLE public.member_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_feature_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read published member features" ON public.member_features;
CREATE POLICY "Public read published member features"
ON public.member_features FOR SELECT TO anon, authenticated
USING (published = true);

DROP POLICY IF EXISTS "Admins read all member features" ON public.member_features;
CREATE POLICY "Admins read all member features"
ON public.member_features FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage member features" ON public.member_features;
CREATE POLICY "Admins manage member features"
ON public.member_features FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Public read published member feature photos" ON public.member_feature_photos;
CREATE POLICY "Public read published member feature photos"
ON public.member_feature_photos FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.member_features f
    WHERE f.id = member_feature_photos.feature_id
      AND f.published = true
  )
);

DROP POLICY IF EXISTS "Admins read all member feature photos" ON public.member_feature_photos;
CREATE POLICY "Admins read all member feature photos"
ON public.member_feature_photos FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage member feature photos" ON public.member_feature_photos;
CREATE POLICY "Admins manage member feature photos"
ON public.member_feature_photos FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

GRANT SELECT ON public.member_features TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_features TO authenticated;

GRANT SELECT ON public.member_feature_photos TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_feature_photos TO authenticated;
