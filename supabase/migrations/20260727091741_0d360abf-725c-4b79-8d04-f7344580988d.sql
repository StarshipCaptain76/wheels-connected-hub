
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  title_af TEXT,
  description TEXT,
  description_af TEXT,
  location TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  cover_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_public_read" ON public.events FOR SELECT USING (is_published = true);

CREATE INDEX events_starts_at_idx ON public.events (starts_at);

CREATE TABLE public.gallery_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  caption TEXT,
  image_url TEXT NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  is_published BOOLEAN NOT NULL DEFAULT true,
  taken_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gallery_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gallery_items TO authenticated;
GRANT ALL ON public.gallery_items TO service_role;
ALTER TABLE public.gallery_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gallery_public_read" ON public.gallery_items FOR SELECT USING (is_published = true);

CREATE INDEX gallery_created_at_idx ON public.gallery_items (created_at DESC);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER events_updated_at BEFORE UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.events (title, title_af, description, description_af, location, starts_at) VALUES
('Breakfast Run — Stilbaai', 'Ontbytrit — Stilbaai', 'Coffee at 7am, wheels rolling by 7:30. Ending at the Stilbaai harbour for breakfast.', 'Koffie om 07:00, wiele rol om 07:30. Eindig by Stilbaai-hawe vir ontbyt.', 'Stilbaai', now() + interval '14 days'),
('Show & Shine — Riversdale', 'Show & Shine — Riversdal', 'Bring your pride and joy. Best-in-show trophy, food trucks and live music.', 'Bring jou trots en vreugde. Best-in-show trofee, kos-trokke en lewende musiek.', 'Riversdale Showgrounds', now() + interval '35 days'),
('Klein Karoo Cruise', 'Klein Karoo Rit', 'Full day scenic run through the Klein Karoo passes.', 'n Volle dag se toneelrit deur die Klein Karoo passe.', 'Route 62', now() + interval '60 days');
