-- 1) gallery_tags DELETE policy: no always-true rule
DROP POLICY IF EXISTS "Any signed-in member can untag" ON public.gallery_tags;
CREATE POLICY "Signed-in members can untag"
ON public.gallery_tags
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 2) Remove anon-facing policies that depended on SECURITY DEFINER helpers
DROP POLICY IF EXISTS profiles_public_read_featured ON public.profiles;
DROP POLICY IF EXISTS gv_public_read_featured ON public.garage_vehicles;
DROP POLICY IF EXISTS gvp_public_read_featured ON public.garage_vehicle_photos;

-- 3) Revoke direct execution of SECURITY DEFINER helpers from untrusted roles
REVOKE ALL ON FUNCTION public.daily_featured_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_featured_user(uuid) FROM PUBLIC, anon, authenticated;

-- 4) Public featured data is served through definer views only
DROP VIEW IF EXISTS public.featured_member_public;
CREATE VIEW public.featured_member_public
WITH (security_invoker = off) AS
SELECT p.id,
       p.display_name,
       p.member_number,
       p.town,
       p.avatar_url,
       p.featured_bio
FROM public.profiles p
WHERE p.id = public.daily_featured_id();

DROP VIEW IF EXISTS public.featured_garage_vehicles_public;
CREATE VIEW public.featured_garage_vehicles_public
WITH (security_invoker = off) AS
SELECT v.*
FROM public.garage_vehicles v
WHERE v.user_id = public.daily_featured_id();

DROP VIEW IF EXISTS public.featured_garage_photos_public;
CREATE VIEW public.featured_garage_photos_public
WITH (security_invoker = off) AS
SELECT ph.*
FROM public.garage_vehicle_photos ph
JOIN public.garage_vehicles v ON v.id = ph.vehicle_id
WHERE v.user_id = public.daily_featured_id();

GRANT SELECT ON public.featured_member_public TO anon, authenticated;
GRANT SELECT ON public.featured_garage_vehicles_public TO anon, authenticated;
GRANT SELECT ON public.featured_garage_photos_public TO anon, authenticated;