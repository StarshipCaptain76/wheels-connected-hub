CREATE TABLE public.event_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  response text CHECK (response IN ('going','maybe','not_going')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_invites TO authenticated;
GRANT ALL ON public.event_invites TO service_role;

ALTER TABLE public.event_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage event invites"
ON public.event_invites FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX event_invites_event_idx ON public.event_invites (event_id);

CREATE OR REPLACE FUNCTION public.set_event_invites_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

REVOKE ALL ON FUNCTION public.set_event_invites_updated_at() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER update_event_invites_updated_at
BEFORE UPDATE ON public.event_invites
FOR EACH ROW EXECUTE FUNCTION public.set_event_invites_updated_at();

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS invites_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS invites_sent_count integer NOT NULL DEFAULT 0;