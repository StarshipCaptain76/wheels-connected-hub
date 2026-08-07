GRANT SELECT ON public.newsletter_editions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.newsletter_editions TO authenticated;
GRANT ALL ON public.newsletter_editions TO service_role;