-- 1. Sponsor applications
CREATE TABLE public.sponsor_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text,
  website text,
  message text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_sponsor_id uuid REFERENCES public.sponsors(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sponsor_applications_status_chk CHECK (status IN ('pending','approved','declined'))
);

GRANT INSERT ON public.sponsor_applications TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sponsor_applications TO authenticated;
GRANT ALL ON public.sponsor_applications TO service_role;

ALTER TABLE public.sponsor_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sponsor_applications_public_insert"
  ON public.sponsor_applications FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'pending' AND reviewed_by IS NULL AND created_sponsor_id IS NULL);

CREATE POLICY "sponsor_applications_admin_read"
  ON public.sponsor_applications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "sponsor_applications_admin_update"
  ON public.sponsor_applications FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "sponsor_applications_admin_delete"
  ON public.sponsor_applications FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER update_sponsor_applications_updated_at
  BEFORE UPDATE ON public.sponsor_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX sponsor_applications_status_idx ON public.sponsor_applications (status, created_at DESC);

-- 2. Sponsor ownership
ALTER TABLE public.sponsors
  ADD COLUMN owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX sponsors_owner_idx ON public.sponsors (owner_user_id);

CREATE POLICY "sponsors_owner_read"
  ON public.sponsors FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

CREATE POLICY "sponsors_owner_update"
  ON public.sponsors FOR UPDATE TO authenticated
  USING (
    owner_user_id = auth.uid()
    AND (billing_ends_at IS NULL OR billing_ends_at >= CURRENT_DATE)
  )
  WITH CHECK (
    owner_user_id = auth.uid()
    AND (billing_ends_at IS NULL OR billing_ends_at >= CURRENT_DATE)
  );

-- Restrict which columns a non-admin owner may change
CREATE OR REPLACE FUNCTION public.sponsors_owner_edit_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.sort IS DISTINCT FROM OLD.sort
     OR NEW.billing_starts_at IS DISTINCT FROM OLD.billing_starts_at
     OR NEW.billing_ends_at IS DISTINCT FROM OLD.billing_ends_at
     OR NEW.expiry_notified_at IS DISTINCT FROM OLD.expiry_notified_at THEN
    RAISE EXCEPTION 'Only club admins can change sponsorship settings';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sponsors_owner_edit_guard() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER sponsors_owner_edit_guard_trg
  BEFORE UPDATE ON public.sponsors
  FOR EACH ROW EXECUTE FUNCTION public.sponsors_owner_edit_guard();

-- 3. Storage: sponsor owners may manage logos under their own prefix
CREATE POLICY "Sponsor owners can upload logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'sponsors'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (SELECT 1 FROM public.sponsors s WHERE s.owner_user_id = auth.uid())
  );

CREATE POLICY "Sponsor owners can update their logos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'sponsors'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (SELECT 1 FROM public.sponsors s WHERE s.owner_user_id = auth.uid())
  );

CREATE POLICY "Sponsor owners can read their logos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'sponsors'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (SELECT 1 FROM public.sponsors s WHERE s.owner_user_id = auth.uid())
  );