-- Admin-only lookup for app secrets stored in cron_secrets or Vault
-- (Supabase dashboard Edge Function secrets live in vault.decrypted_secrets).
CREATE OR REPLACE FUNCTION public.app_secret(_name text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT c.secret INTO v
  FROM public.cron_secrets c
  WHERE c.name = _name
  LIMIT 1;
  IF v IS NOT NULL AND length(btrim(v)) > 0 THEN
    RETURN btrim(v);
  END IF;

  BEGIN
    EXECUTE
      'SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = $1 LIMIT 1'
      INTO v
      USING _name;
  EXCEPTION WHEN OTHERS THEN
    v := NULL;
  END;

  IF v IS NOT NULL AND length(btrim(v)) > 0 THEN
    RETURN btrim(v);
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.app_secret(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_secret(text) TO authenticated, service_role;
