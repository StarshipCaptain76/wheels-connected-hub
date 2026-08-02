DROP POLICY IF EXISTS profiles_public_read_featured ON public.profiles;
CREATE POLICY profiles_public_read_featured ON public.profiles
  FOR SELECT TO anon, authenticated
  USING (id = public.daily_featured_id());

DROP VIEW IF EXISTS public.featured_member_public;
CREATE VIEW public.featured_member_public
WITH (security_invoker = on) AS
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
