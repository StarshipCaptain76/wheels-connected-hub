CREATE TABLE public.newsletter_editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  title_en text NOT NULL DEFAULT '',
  title_af text NOT NULL DEFAULT '',
  body_en text NOT NULL DEFAULT '',
  body_af text NOT NULL DEFAULT '',
  admin_notes text,
  pdf_path text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','published')),
  is_published boolean NOT NULL DEFAULT false,
  sent_at timestamptz,
  sent_count integer NOT NULL DEFAULT 0,
  published_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, month)
);

GRANT SELECT ON public.newsletter_editions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.newsletter_editions TO authenticated;
GRANT ALL ON public.newsletter_editions TO service_role;

ALTER TABLE public.newsletter_editions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published editions are public"
  ON public.newsletter_editions FOR SELECT
  USING (is_published = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert editions"
  ON public.newsletter_editions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update editions"
  ON public.newsletter_editions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete editions"
  ON public.newsletter_editions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER newsletter_editions_set_updated_at
  BEFORE UPDATE ON public.newsletter_editions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();