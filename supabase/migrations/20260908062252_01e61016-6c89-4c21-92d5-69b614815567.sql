-- 1. Anon-safe wrapper for public admin alerts only
CREATE OR REPLACE FUNCTION public.fanout_admin_alert(
  _type text,
  _title_en text,
  _title_af text,
  _body_en text DEFAULT NULL,
  _body_af text DEFAULT NULL,
  _link text DEFAULT NULL,
  _related_id uuid DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _count integer;
BEGIN
  IF _type NOT IN ('admin_new_member', 'admin_new_sponsor') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  WITH recips AS (
    SELECT ur.user_id AS id FROM public.user_roles ur WHERE ur.role = 'admin'
  ), filtered AS (
    SELECT r.id FROM recips r
    LEFT JOIN public.notification_prefs np ON np.user_id = r.id
    WHERE COALESCE(CASE _type
      WHEN 'admin_new_sponsor' THEN np.admin_new_sponsor
      WHEN 'admin_new_member' THEN np.admin_new_member END, true)
  )
  INSERT INTO public.notifications (user_id, type, title_en, title_af, body_en, body_af, link, related_id)
  SELECT id, _type, _title_en, _title_af, _body_en, _body_af, _link, _related_id FROM filtered;

  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

REVOKE ALL ON FUNCTION public.fanout_admin_alert(text, text, text, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fanout_admin_alert(text, text, text, text, text, text, uuid) TO anon, authenticated, service_role;

-- 2. Restore VOLATILE so the reminder job can write again
CREATE OR REPLACE FUNCTION public.send_event_reminder(_key text, _event_id uuid)
 RETURNS TABLE(email text, lang text, display_name text)
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ev record;
BEGIN
  IF NOT public.cron_key_ok('event_reminders', _key) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  UPDATE public.events e
    SET reminder_sent_at = now()
    WHERE e.id = _event_id
      AND e.is_published = true
      AND e.reminder_sent_at IS NULL
      AND (e.starts_at AT TIME ZONE 'Africa/Johannesburg')::date
          = ((now() AT TIME ZONE 'Africa/Johannesburg')::date + 1)
    RETURNING e.id, e.title, e.title_af, e.location, e.starts_at INTO ev;

  IF ev.id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (user_id, type, title_en, title_af, body_en, body_af, link, related_id)
  SELECT p.id,
         'event_reminder',
         'Tomorrow: ' || ev.title,
         'Môre: ' || COALESCE(ev.title_af, ev.title),
         to_char(ev.starts_at AT TIME ZONE 'Africa/Johannesburg', 'HH24:MI')
           || COALESCE(' - ' || ev.location, ''),
         to_char(ev.starts_at AT TIME ZONE 'Africa/Johannesburg', 'HH24:MI')
           || COALESCE(' - ' || ev.location, ''),
         '/events/' || ev.id::text,
         ev.id
  FROM public.profiles p
  LEFT JOIN public.notification_prefs np ON np.user_id = p.id
  WHERE p.membership_status = 'active'
    AND COALESCE(np.event_reminder, true);

  RETURN QUERY
  SELECT me.email, COALESCE(p.preferred_lang, 'en'), p.display_name
  FROM public.profiles p
  JOIN public.member_emails me ON me.user_id = p.id
  JOIN public.event_rsvps r ON r.user_id = p.id AND r.event_id = ev.id
  LEFT JOIN public.notification_prefs np ON np.user_id = p.id
  WHERE p.membership_status = 'active'
    AND COALESCE(np.event_reminder, true)
    AND me.email IS NOT NULL
    AND r.status IN ('going','maybe');
END;
$function$;

REVOKE ALL ON FUNCTION public.send_event_reminder(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_event_reminder(text, uuid) TO anon, authenticated, service_role;