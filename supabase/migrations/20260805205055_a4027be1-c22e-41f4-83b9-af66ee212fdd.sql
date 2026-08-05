CREATE OR REPLACE FUNCTION public.hidden_directory_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT user_id FROM public.member_emails WHERE lower(email) = 'admin@justwheels.co.za'
$$;
REVOKE ALL ON FUNCTION public.hidden_directory_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hidden_directory_ids() TO anon, authenticated, service_role;