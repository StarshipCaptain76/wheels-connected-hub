ALTER TABLE public.profiles ALTER COLUMN membership_status SET DEFAULT 'active';
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name, membership_status)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), 'active')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member') ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.member_emails (user_id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, updated_at = now();
  PERFORM public.grant_admin_if_allowlisted(NEW.id, NEW.email, NEW.email_confirmed_at);
  RETURN NEW;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;