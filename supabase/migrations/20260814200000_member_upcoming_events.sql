-- Profile "Upcoming events" for another member.
-- event_rsvps SELECT is owner-only (notes stay private); this RPC exposes
-- only going/maybe on published future events — no note, no party size.

CREATE OR REPLACE FUNCTION public.member_upcoming_events(_user_id uuid)
RETURNS TABLE(
  event_id uuid,
  title text,
  starts_at timestamptz,
  status public.rsvp_status
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT e.id, e.title, e.starts_at, r.status
  FROM public.event_rsvps r
  JOIN public.events e ON e.id = r.event_id
  WHERE r.user_id = _user_id
    AND auth.uid() IS NOT NULL
    AND e.is_published = true
    AND e.starts_at >= now()
    AND r.status IN ('going', 'maybe')
$$;

REVOKE EXECUTE ON FUNCTION public.member_upcoming_events(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.member_upcoming_events(uuid) TO authenticated;
