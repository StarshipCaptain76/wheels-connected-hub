CREATE TABLE public.sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tagline text,
  tagline_af text,
  website_url text,
  logo_path text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sponsors TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sponsors TO authenticated;
GRANT ALL ON public.sponsors TO service_role;

ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;

CREATE POLICY sponsors_public_read ON public.sponsors
  FOR SELECT USING (is_active = true);

CREATE POLICY sponsors_admin_read_all ON public.sponsors
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY sponsors_admin_insert ON public.sponsors
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY sponsors_admin_update ON public.sponsors
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY sponsors_admin_delete ON public.sponsors
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER sponsors_updated_at
  BEFORE UPDATE ON public.sponsors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage policies for the private 'sponsors' bucket
CREATE POLICY "Sponsor logos are readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'sponsors');

CREATE POLICY "Admins can upload sponsor logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sponsors' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update sponsor logos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'sponsors' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete sponsor logos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'sponsors' AND public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.sponsors (name, tagline, tagline_af, website_url, logo_path, sort)
VALUES
  ('Hessequa Motors', 'Parts & service for classics', 'Onderdele & diens vir klassieke', 'https://example.com', 'seed/hessequa-motors.svg', 10),
  ('Garden Route Tyres', 'Rubber for every ride', 'Rubber vir elke ry', 'https://example.com', 'seed/garden-route-tyres.svg', 20),
  ('Southern Cape Panel', 'Body work & respray', 'Bakwerk & herspuit', 'https://example.com', 'seed/sc-panel.svg', 30);
