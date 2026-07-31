-- Helper so garage policies can still detect the featured member without a public profiles read
CREATE OR REPLACE FUNCTION public.is_featured_user(_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _id AND p.is_featured = true)
$$;

REVOKE ALL ON FUNCTION public.is_featured_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_featured_user(uuid) TO anon, authenticated, service_role;

-- Rebuild featured garage policies on the helper
DROP POLICY IF EXISTS gv_public_read_featured ON public.garage_vehicles;
CREATE POLICY gv_public_read_featured ON public.garage_vehicles
  FOR SELECT USING (public.is_featured_user(user_id));

DROP POLICY IF EXISTS gvp_public_read_featured ON public.garage_vehicle_photos;
CREATE POLICY gvp_public_read_featured ON public.garage_vehicle_photos
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.garage_vehicles v
    WHERE v.id = garage_vehicle_photos.vehicle_id
      AND public.is_featured_user(v.user_id)
  ));

-- Remove full-row anonymous access to the featured profile
DROP POLICY IF EXISTS profiles_public_read_featured ON public.profiles;

-- Narrow public projection of the featured member
CREATE OR REPLACE VIEW public.featured_member_public
WITH (security_invoker = off) AS
  SELECT
    p.id,
    p.display_name,
    p.member_number,
    p.town,
    p.favourite_ride,
    p.featured_bio,
    p.featured_photo_url,
    p.avatar_url,
    p.featured_since
  FROM public.profiles p
  WHERE p.is_featured = true;

REVOKE ALL ON public.featured_member_public FROM PUBLIC;
GRANT SELECT ON public.featured_member_public TO anon, authenticated, service_role;