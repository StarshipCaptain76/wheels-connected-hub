ALTER TABLE public.events ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
ALTER TABLE public.notification_prefs ADD COLUMN IF NOT EXISTS event_reminder boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.cron_secrets (
  name text PRIMARY KEY,
  secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.cron_secrets TO service_role;
ALTER TABLE public.cron_secrets ENABLE ROW LEVEL SECURITY;

INSERT INTO public.cron_secrets (name, secret)
VALUES ('event_reminders', encode(gen_random_bytes(24), 'hex'))
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.cron_key_ok(_name text, _key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cron_secrets c
    WHERE c.name = _name AND _key IS NOT NULL AND c.secret = _key
  )
$$;
REVOKE ALL ON FUNCTION public.cron_key_ok(text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.event_reminders_due(_key text)
RETURNS TABLE(event_id uuid, title text, title_af text, location text, starts_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.cron_key_ok('event_reminders', _key) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  RETURN QUERY
  SELECT e.id, e.title, e.title_af, e.location, e.starts_at
  FROM public.events e
  WHERE e.is_published = true
    AND e.reminder_sent_at IS NULL
    AND (e.starts_at AT TIME ZONE 'Africa/Johannesburg')::date
        = ((now() AT TIME ZONE 'Africa/Johannesburg')::date + 1)
  ORDER BY e.starts_at;
END;
$$;
REVOKE ALL ON FUNCTION public.event_reminders_due(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_reminders_due(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.send_event_reminder(_key text, _event_id uuid)
RETURNS TABLE(email text, lang text, display_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  RETURN QUERY
  SELECT me.email, COALESCE(p.preferred_lang, 'en'), p.display_name
  FROM public.profiles p
  JOIN public.member_emails me ON me.user_id = p.id
  LEFT JOIN public.notification_prefs np ON np.user_id = p.id
  WHERE p.membership_status = 'active'
    AND COALESCE(np.event_reminder, true)
    AND me.email IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.send_event_reminder(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_event_reminder(text, uuid) TO anon, authenticated;