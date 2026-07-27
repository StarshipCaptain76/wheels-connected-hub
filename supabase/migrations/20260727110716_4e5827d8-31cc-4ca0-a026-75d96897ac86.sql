-- Remove the temporary security-definer view and its access policy
DROP VIEW IF EXISTS public.listings_public;
DROP POLICY IF EXISTS listings_authenticated_read_approved ON public.listings;

-- Gallery storage: restrict write/delete to admins only
DROP POLICY IF EXISTS "gallery_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "gallery_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "gallery_admin_delete" ON storage.objects;

CREATE POLICY "gallery_admin_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'gallery' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "gallery_admin_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'gallery' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "gallery_admin_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'gallery' AND public.has_role(auth.uid(), 'admin'));

-- Create a separate table for seller contact details
CREATE TABLE public.listing_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  contact_name text NOT NULL,
  contact_phone text,
  contact_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_contacts TO authenticated;
GRANT ALL ON public.listing_contacts TO service_role;

ALTER TABLE public.listing_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY listing_contacts_authenticated_read_approved ON public.listing_contacts
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.status = 'approved'));

CREATE POLICY listing_contacts_owner_read ON public.listing_contacts
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.user_id = auth.uid()));

CREATE POLICY listing_contacts_admin_read ON public.listing_contacts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY listing_contacts_owner_insert ON public.listing_contacts
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.user_id = auth.uid()));

CREATE POLICY listing_contacts_owner_update ON public.listing_contacts
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.user_id = auth.uid()));

CREATE POLICY listing_contacts_owner_delete ON public.listing_contacts
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.user_id = auth.uid()));

CREATE POLICY listing_contacts_admin_manage ON public.listing_contacts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Migrate existing contact data
INSERT INTO public.listing_contacts (listing_id, contact_name, contact_phone, contact_email)
SELECT id, contact_name, contact_phone, contact_email
FROM public.listings
WHERE contact_name IS NOT NULL AND contact_email IS NOT NULL;

-- Drop contact columns from listings so anonymous reads cannot see them
ALTER TABLE public.listings DROP COLUMN contact_name;
ALTER TABLE public.listings DROP COLUMN contact_phone;
ALTER TABLE public.listings DROP COLUMN contact_email;

-- Restore anonymous read access to the now contact-free listings table
CREATE POLICY listings_public_read_approved ON public.listings
  FOR SELECT TO anon, authenticated
  USING (status = 'approved');
