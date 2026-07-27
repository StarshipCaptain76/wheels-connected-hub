
REVOKE ALL ON FUNCTION public.grant_admin_if_allowlisted(uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_auth_user_confirmed_admin() FROM PUBLIC, anon, authenticated;
