DROP FUNCTION IF EXISTS public.event_attendees(uuid);
CREATE FUNCTION public.event_attendees(_event_id uuid)
RETURNS TABLE(user_id uuid, status rsvp_status, party_size integer, note text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT r.user_id, r.status, r.party_size, r.note
  FROM public.event_rsvps r
  JOIN public.events e ON e.id = r.event_id
  WHERE r.event_id = _event_id
    AND auth.uid() IS NOT NULL
    AND (e.is_published = true OR public.has_role(auth.uid(), 'admin'::app_role))
    AND r.status IN ('going','maybe')
$function$;
REVOKE ALL ON FUNCTION public.event_attendees(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.event_attendees(uuid) TO authenticated;