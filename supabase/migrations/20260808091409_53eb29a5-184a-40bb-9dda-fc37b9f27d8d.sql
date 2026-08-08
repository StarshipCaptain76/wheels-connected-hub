-- 1. Revoke anon EXECUTE on non-public SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.fanout_notification(text,text,text,text,text,text,uuid,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_user(uuid,text,text,text,text,text,text,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.route_cache_put(text,jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.hidden_directory_ids() FROM anon;
REVOKE EXECUTE ON FUNCTION public.concours_vehicles_guard() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.concours_scores_guard() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rsvp_via_invite(uuid,text) FROM anon;

-- 2. Concours vehicles: only expose rows for events whose concours is enabled
DROP POLICY IF EXISTS "Anyone can read concours vehicles" ON public.event_concours_vehicles;

CREATE POLICY "Public can read enabled concours vehicles"
ON public.event_concours_vehicles FOR SELECT TO anon
USING (EXISTS (
  SELECT 1 FROM public.event_concours ec
  WHERE ec.event_id = event_concours_vehicles.event_id AND ec.enabled = true
));

CREATE POLICY "Members can read enabled concours vehicles"
ON public.event_concours_vehicles FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.event_concours ec
    WHERE ec.event_id = event_concours_vehicles.event_id AND ec.enabled = true
  )
);

-- 3. RSVPs: no broad member read of notes/party details
DROP POLICY IF EXISTS "event_rsvps_members_read" ON public.event_rsvps;

CREATE POLICY "event_rsvps_owner_read"
ON public.event_rsvps FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Attendee list without personal notes, members only
CREATE OR REPLACE FUNCTION public.event_attendees(_event_id uuid)
RETURNS TABLE(user_id uuid, status rsvp_status, party_size integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT r.user_id, r.status, r.party_size
  FROM public.event_rsvps r
  JOIN public.events e ON e.id = r.event_id
  WHERE r.event_id = _event_id
    AND auth.uid() IS NOT NULL
    AND (e.is_published = true OR public.has_role(auth.uid(), 'admin'::app_role))
    AND r.status IN ('going','maybe')
$$;

REVOKE EXECUTE ON FUNCTION public.event_attendees(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.event_attendees(uuid) TO authenticated;