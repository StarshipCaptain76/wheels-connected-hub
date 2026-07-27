
-- Allowlist-based admin grant
CREATE OR REPLACE FUNCTION public.grant_admin_if_allowlisted(_user_id uuid, _email text, _confirmed_at timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _confirmed_at IS NULL OR _email IS NULL THEN
    RETURN;
  END IF;
  IF lower(_email) IN ('admin@justwheels.co.za','dawie@polka.co.za') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END;
$$;

-- Extend handle_new_user to also grant admin when applicable
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member')
  ON CONFLICT (user_id, role) DO NOTHING;

  PERFORM public.grant_admin_if_allowlisted(NEW.id, NEW.email, NEW.email_confirmed_at);

  RETURN NEW;
END;
$$;

-- Trigger for email confirmation transitions (covers OAuth first-login + delayed email confirm)
CREATE OR REPLACE FUNCTION public.on_auth_user_confirmed_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.grant_admin_if_allowlisted(NEW.id, NEW.email, NEW.email_confirmed_at);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_confirmed_grant_admin ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_grant_admin
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.on_auth_user_confirmed_admin();

-- Backfill existing confirmed users
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role
FROM auth.users u
WHERE lower(u.email) IN ('admin@justwheels.co.za','dawie@polka.co.za')
  AND u.email_confirmed_at IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;
