
CREATE TABLE public.merch_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  name_af text,
  description text,
  description_af text,
  price_zar numeric,
  sizes text[] NOT NULL DEFAULT '{}',
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.merch_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merch_items TO authenticated;
GRANT ALL ON public.merch_items TO service_role;

ALTER TABLE public.merch_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY merch_items_public_read ON public.merch_items
  FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE POLICY merch_items_admin_read_all ON public.merch_items
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY merch_items_admin_manage ON public.merch_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_merch_items_updated_at
  BEFORE UPDATE ON public.merch_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.merch_items (name, name_af, description, description_af, price_zar, sizes, sort) VALUES
  ('Classic Club Cap', 'Klassieke Klub Pet', 'Embroidered caveman logo. Adjustable.', 'Geborduurde logo. Verstelbaar.', 220, '{}', 10),
  ('Logo Tee', 'Logo T-Hemp', 'Heavy cotton, screen-printed front & back.', 'Swaar katoen, voor & agter gedruk.', 320, ARRAY['S','M','L','XL','XXL'], 20),
  ('Workshop Hoodie', 'Werkswinkel Hoodie', 'Fleece-lined, oil-resistant not guaranteed.', 'Wolgevoerd, olie-bestand nie gewaarborg nie.', 650, ARRAY['S','M','L','XL','XXL'], 30),
  ('Iron-on Patch', 'Stryklap', '80mm circular, full-colour.', '80mm rond, volkleur.', 80, '{}', 40),
  ('Sticker Pack (3)', 'Plakkerpak (3)', 'Weatherproof, for helmets, laptops and toolboxes.', 'Weerbestand, vir helmets, skootrekenaars en gereedskapkiste.', 60, '{}', 50),
  ('Enamel Camp Mug', 'Emalje Kampbeker', 'For breakfast run coffee. 350ml.', 'Vir ontbytry-koffie. 350ml.', 140, '{}', 60);
