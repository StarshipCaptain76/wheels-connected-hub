-- Fix gallery storage policies: restrict write/delete to admins only
DROP POLICY IF EXISTS "gallery_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "gallery_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "gallery_auth_delete" ON storage.objects;

CREATE POLICY "gallery_admin_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'gallery' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "gallery_admin_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'gallery' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "gallery_admin_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'gallery' AND public.has_role(auth.uid(), 'admin'));

-- Fix listings public read: expose only non-contact fields to anonymous users via a view
CREATE OR REPLACE VIEW public.listings_public WITH (security_invoker = false) AS
SELECT
  id,
  title,
  title_af,
  description,
  description_af,
  price_zar,
  category,
  condition,
  location,
  status,
  created_at,
  updated_at
FROM public.listings
WHERE status = 'approved';

GRANT SELECT ON public.listings_public TO anon;
GRANT SELECT ON public.listings_public TO authenticated;
GRANT ALL ON public.listings_public TO service_role;

-- Restrict the direct table read policy so anonymous users cannot read contact columns
DROP POLICY IF EXISTS listings_public_read_approved ON public.listings;
CREATE POLICY listings_authenticated_read_approved ON public.listings
  FOR SELECT TO authenticated
  USING (status = 'approved');
