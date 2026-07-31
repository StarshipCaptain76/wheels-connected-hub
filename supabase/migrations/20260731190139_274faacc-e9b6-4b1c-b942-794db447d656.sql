-- Restore the featured-row policy; anonymous column grants already exclude phone,
-- membership_status, directory_visible and other private fields.
DROP POLICY IF EXISTS profiles_public_read_featured ON public.profiles;
CREATE POLICY profiles_public_read_featured ON public.profiles
  FOR SELECT TO anon, authenticated USING (is_featured = true);

-- Make the public projection run as the caller (no SECURITY DEFINER view)
ALTER VIEW public.featured_member_public SET (security_invoker = on);

-- Belt and braces: ensure anon cannot select private columns directly
REVOKE SELECT (phone, membership_status, directory_visible, preferred_lang, joined_at, created_at, updated_at)
  ON public.profiles FROM anon;
GRANT SELECT (id, display_name, member_number, town, favourite_ride, featured_bio, featured_photo_url, avatar_url, featured_since, is_featured)
  ON public.profiles TO anon;