
-- Events extra columns (all optional; existing rows keep working)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS destination_lat numeric,
  ADD COLUMN IF NOT EXISTS destination_lng numeric,
  ADD COLUMN IF NOT EXISTS destination_place_id text,
  ADD COLUMN IF NOT EXISTS destination_address text,
  ADD COLUMN IF NOT EXISTS hero_image_url text,
  ADD COLUMN IF NOT EXISTS details_md text,
  ADD COLUMN IF NOT EXISTS details_af_md text;

-- Waypoints
CREATE TABLE IF NOT EXISTS public.event_waypoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  label text NOT NULL,
  label_af text,
  address text,
  lat numeric,
  lng numeric,
  place_id text,
  meet_time timestamptz,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_waypoints_event_id_idx ON public.event_waypoints(event_id, sort);

GRANT SELECT ON public.event_waypoints TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_waypoints TO authenticated;
GRANT ALL ON public.event_waypoints TO service_role;

ALTER TABLE public.event_waypoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY event_waypoints_public_read ON public.event_waypoints
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_waypoints.event_id AND e.is_published = true));

CREATE POLICY event_waypoints_admin_read_all ON public.event_waypoints
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY event_waypoints_admin_manage ON public.event_waypoints
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER event_waypoints_set_updated_at
BEFORE UPDATE ON public.event_waypoints
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RSVPs
DO $$ BEGIN
  CREATE TYPE public.rsvp_status AS ENUM ('going','maybe','not_going');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.event_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.rsvp_status NOT NULL,
  party_size integer NOT NULL DEFAULT 1 CHECK (party_size BETWEEN 1 AND 10),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS event_rsvps_event_id_idx ON public.event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS event_rsvps_user_id_idx ON public.event_rsvps(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_rsvps TO authenticated;
GRANT ALL ON public.event_rsvps TO service_role;

ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

-- Members can see all RSVPs on published events (attendee list is members-only)
CREATE POLICY event_rsvps_members_read ON public.event_rsvps
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_rsvps.event_id AND e.is_published = true));

CREATE POLICY event_rsvps_admin_read_all ON public.event_rsvps
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY event_rsvps_owner_insert ON public.event_rsvps
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY event_rsvps_owner_update ON public.event_rsvps
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY event_rsvps_owner_delete ON public.event_rsvps
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY event_rsvps_admin_manage ON public.event_rsvps
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER event_rsvps_set_updated_at
BEFORE UPDATE ON public.event_rsvps
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Public counts for signed-out visitors
CREATE OR REPLACE VIEW public.event_rsvp_counts
WITH (security_invoker = true) AS
SELECT
  e.id AS event_id,
  COUNT(*) FILTER (WHERE r.status = 'going') AS going_count,
  COALESCE(SUM(CASE WHEN r.status = 'going' THEN r.party_size ELSE 0 END), 0) AS going_party_total,
  COUNT(*) FILTER (WHERE r.status = 'maybe') AS maybe_count,
  COUNT(*) FILTER (WHERE r.status = 'not_going') AS not_going_count
FROM public.events e
LEFT JOIN public.event_rsvps r ON r.event_id = e.id
WHERE e.is_published = true
GROUP BY e.id;

GRANT SELECT ON public.event_rsvp_counts TO anon, authenticated;

-- Route cache (server-only writes)
CREATE TABLE IF NOT EXISTS public.route_cache (
  cache_key text PRIMARY KEY,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);
GRANT SELECT ON public.route_cache TO anon, authenticated;
GRANT ALL ON public.route_cache TO service_role;
ALTER TABLE public.route_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY route_cache_public_read ON public.route_cache FOR SELECT TO anon, authenticated USING (true);
