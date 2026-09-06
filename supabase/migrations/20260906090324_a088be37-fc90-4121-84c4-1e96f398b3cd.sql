CREATE OR REPLACE FUNCTION public.send_event_reminder(_key text, _event_id uuid)
 RETURNS TABLE(email text, lang text, display_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
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
         'More: ' || COALESCE(ev.title_af, ev.title),
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

  -- Email reminders go to members who said they are going (or maybe)
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
REVOKE ALL ON FUNCTION public.send_event_reminder(text, uuid) FROM PUBLIC, anon, authenticated;