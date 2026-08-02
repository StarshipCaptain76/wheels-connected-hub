CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title_en text NOT NULL,
  title_af text NOT NULL,
  body_en text,
  body_af text,
  link text,
  related_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_created_idx ON public.notifications (user_id, created_at DESC);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own notifications readable" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "own notifications updatable" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.notification_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  new_listing boolean NOT NULL DEFAULT true,
  new_event boolean NOT NULL DEFAULT true,
  new_newsletter boolean NOT NULL DEFAULT true,
  admin_new_sponsor boolean NOT NULL DEFAULT true,
  admin_new_member boolean NOT NULL DEFAULT true,
  admin_listing_review boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.notification_prefs TO authenticated;
GRANT ALL ON public.notification_prefs TO service_role;

ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own prefs readable" ON public.notification_prefs
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "own prefs insertable" ON public.notification_prefs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "own prefs updatable" ON public.notification_prefs
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.set_notification_prefs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_notification_prefs_updated_at() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER update_notification_prefs_updated_at
  BEFORE UPDATE ON public.notification_prefs
  FOR EACH ROW EXECUTE FUNCTION public.set_notification_prefs_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;