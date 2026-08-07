DROP POLICY IF EXISTS "Published editions readable by anyone" ON public.newsletter_editions;
DROP POLICY IF EXISTS "Members read published, admins read all" ON public.newsletter_editions;

CREATE POLICY "Anon reads published editions"
ON public.newsletter_editions
FOR SELECT
TO anon
USING (is_published = true);

CREATE POLICY "Authed reads published, admins read all"
ON public.newsletter_editions
FOR SELECT
TO authenticated
USING (is_published = true OR public.has_role(auth.uid(), 'admin'));

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;