-- Enums
CREATE TYPE public.listing_category AS ENUM ('parts', 'cars', 'memorabilia', 'other');
CREATE TYPE public.listing_condition AS ENUM ('new', 'used', 'project');
CREATE TYPE public.listing_status AS ENUM ('pending', 'approved', 'rejected', 'sold');

-- Listings table
CREATE TABLE public.listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  title_af text,
  description text NOT NULL,
  description_af text,
  price_zar numeric(12,2),
  category public.listing_category NOT NULL DEFAULT 'other',
  condition public.listing_condition NOT NULL DEFAULT 'used',
  location text,
  contact_name text NOT NULL,
  contact_phone text,
  contact_email text NOT NULL,
  status public.listing_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.listings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listings TO authenticated;
GRANT ALL ON public.listings TO service_role;

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

-- Public read approved
CREATE POLICY listings_public_read_approved ON public.listings
  FOR SELECT TO anon, authenticated
  USING (status = 'approved');

-- Owner read own (any status)
CREATE POLICY listings_owner_read_own ON public.listings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admin read all
CREATE POLICY listings_admin_read_all ON public.listings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Owner insert (status forced to pending via check)
CREATE POLICY listings_owner_insert ON public.listings
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

-- Owner update own; status may only be changed to 'sold' by owner, other statuses stay same
CREATE POLICY listings_owner_update ON public.listings
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND (
      status = (SELECT status FROM public.listings l WHERE l.id = listings.id)
      OR status = 'sold'
    )
  );

-- Admin update all (including status)
CREATE POLICY listings_admin_update ON public.listings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Owner delete own
CREATE POLICY listings_owner_delete ON public.listings
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Admin delete all
CREATE POLICY listings_admin_delete ON public.listings
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger
CREATE TRIGGER listings_set_updated_at
  BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Listing photos
CREATE TABLE public.listing_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.listing_photos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_photos TO authenticated;
GRANT ALL ON public.listing_photos TO service_role;

ALTER TABLE public.listing_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY listing_photos_public_read ON public.listing_photos
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.status = 'approved'));

CREATE POLICY listing_photos_owner_read ON public.listing_photos
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.user_id = auth.uid()));

CREATE POLICY listing_photos_admin_read ON public.listing_photos
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY listing_photos_owner_write ON public.listing_photos
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.user_id = auth.uid()));

CREATE POLICY listing_photos_owner_update ON public.listing_photos
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.user_id = auth.uid()));

CREATE POLICY listing_photos_owner_delete ON public.listing_photos
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.user_id = auth.uid()));

CREATE POLICY listing_photos_admin_manage ON public.listing_photos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX listings_status_created_idx ON public.listings(status, created_at DESC);
CREATE INDEX listings_user_id_idx ON public.listings(user_id);
CREATE INDEX listing_photos_listing_id_idx ON public.listing_photos(listing_id, sort);