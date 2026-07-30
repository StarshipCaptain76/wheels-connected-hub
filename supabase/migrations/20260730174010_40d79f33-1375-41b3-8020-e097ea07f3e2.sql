-- 1. Featured profile: column-level access for anon
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (id, display_name, member_number, town, favourite_ride, featured_bio, featured_photo_url, avatar_url, featured_since, is_featured) ON public.profiles TO anon;

-- 2. Garage vehicles: anon limited to the featured member
DROP POLICY IF EXISTS garage_vehicles_public_read ON public.garage_vehicles;
DROP POLICY IF EXISTS gv_public_read ON public.garage_vehicles;
CREATE POLICY gv_public_read_featured ON public.garage_vehicles
  FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = garage_vehicles.user_id AND p.is_featured = true));

DROP POLICY IF EXISTS garage_photos_public_read ON public.garage_vehicle_photos;
DROP POLICY IF EXISTS gvp_select ON public.garage_vehicle_photos;
CREATE POLICY gvp_public_read_featured ON public.garage_vehicle_photos
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.garage_vehicles v
    JOIN public.profiles p ON p.id = v.user_id
    WHERE v.id = garage_vehicle_photos.vehicle_id AND p.is_featured = true));

-- 3. route_cache: server-only
DROP POLICY IF EXISTS route_cache_public_read ON public.route_cache;
REVOKE SELECT ON public.route_cache FROM anon, authenticated;

-- 4. Storage: remove permissive upload policies (admin-only policies remain)
DROP POLICY IF EXISTS gallery_upload ON storage.objects;
DROP POLICY IF EXISTS sponsors_upload ON storage.objects;

-- 5. Storage: remove broad bucket-listing SELECT policies on public buckets
DROP POLICY IF EXISTS gallery_public_read ON storage.objects;
DROP POLICY IF EXISTS sponsors_public_read ON storage.objects;
DROP POLICY IF EXISTS garage_select_public ON storage.objects;
DROP POLICY IF EXISTS events_select_public ON storage.objects;

-- 6. SECURITY DEFINER functions not meant for direct calls
REVOKE EXECUTE ON FUNCTION public.grant_admin_if_allowlisted(uuid, text, timestamptz) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_auth_user_confirmed_admin() FROM anon, authenticated;