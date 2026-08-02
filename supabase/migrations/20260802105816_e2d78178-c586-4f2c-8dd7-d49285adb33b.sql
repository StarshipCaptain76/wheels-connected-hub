CREATE OR REPLACE FUNCTION public.daily_featured_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.id
  FROM public.profiles p
  WHERE p.membership_status = 'active'
    AND COALESCE(p.directory_visible, true) = true
  ORDER BY md5((CURRENT_DATE)::text || p.id::text)
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.daily_featured_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.daily_featured_id() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_featured_user(_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _id IS NOT NULL AND _id = public.daily_featured_id()
$$;

DROP VIEW IF EXISTS public.featured_member_public;
CREATE VIEW public.featured_member_public
WITH (security_invoker = off) AS
  SELECT p.id,
         p.display_name,
         p.member_number,
         p.town,
         p.favourite_ride,
         p.featured_bio,
         p.featured_photo_url,
         p.avatar_url,
         p.featured_since
  FROM public.profiles p
  WHERE p.id = public.daily_featured_id();

GRANT SELECT ON public.featured_member_public TO anon, authenticated;
