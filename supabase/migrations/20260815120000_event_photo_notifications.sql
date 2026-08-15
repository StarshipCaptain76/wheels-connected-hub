-- In-app notification when members add photos to a past event.
-- Default on; members can opt out via notification_prefs.event_photo.

ALTER TABLE public.notification_prefs
  ADD COLUMN IF NOT EXISTS event_photo boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS notifications_event_photo_related_idx
  ON public.notifications (related_id, created_at DESC)
  WHERE type = 'event_photo';

CREATE OR REPLACE FUNCTION public.fanout_notification(
  _type text,
  _title_en text,
  _title_af text,
  _body_en text DEFAULT NULL,
  _body_af text DEFAULT NULL,
  _link text DEFAULT NULL,
  _related_id uuid DEFAULT NULL,
  _exclude uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _count integer;
BEGIN
  IF _type NOT IN (
    'new_listing',
    'new_event',
    'new_newsletter',
    'admin_new_sponsor',
    'admin_new_member',
    'admin_listing_review',
    'photo_tag',
    'event_photo'
  ) THEN
    RAISE EXCEPTION 'Unknown notification type %', _type;
  END IF;
  IF auth.uid() IS NULL AND _type NOT IN ('admin_new_member', 'admin_new_sponsor') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  WITH recips AS (
    SELECT ur.user_id AS id FROM public.user_roles ur
      WHERE ur.role = 'admin' AND _type LIKE 'admin\_%'
    UNION
    SELECT p.id FROM public.profiles p
      WHERE p.membership_status = 'active' AND _type NOT LIKE 'admin\_%'
  ), filtered AS (
    SELECT r.id FROM recips r
    LEFT JOIN public.notification_prefs np ON np.user_id = r.id
    WHERE (_exclude IS NULL OR r.id <> _exclude)
      AND COALESCE(CASE _type
        WHEN 'new_listing' THEN np.new_listing
        WHEN 'new_event' THEN np.new_event
        WHEN 'new_newsletter' THEN np.new_newsletter
        WHEN 'admin_new_sponsor' THEN np.admin_new_sponsor
        WHEN 'admin_new_member' THEN np.admin_new_member
        WHEN 'admin_listing_review' THEN np.admin_listing_review
        WHEN 'photo_tag' THEN np.photo_tag
        WHEN 'event_photo' THEN np.event_photo END, true)
  )
  INSERT INTO public.notifications (user_id, type, title_en, title_af, body_en, body_af, link, related_id)
  SELECT id, _type, _title_en, _title_af, _body_en, _body_af, _link, _related_id FROM filtered;

  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_user(
  _user_id uuid,
  _type text,
  _title_en text,
  _title_af text,
  _body_en text DEFAULT NULL,
  _body_af text DEFAULT NULL,
  _link text DEFAULT NULL,
  _related_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _count integer; _allowed boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF _type NOT IN (
    'photo_tag',
    'new_listing',
    'new_event',
    'new_newsletter',
    'admin_new_sponsor',
    'admin_new_member',
    'admin_listing_review',
    'event_photo'
  ) THEN
    RAISE EXCEPTION 'Unknown notification type %', _type;
  END IF;

  SELECT COALESCE(CASE _type
    WHEN 'photo_tag' THEN np.photo_tag
    WHEN 'new_listing' THEN np.new_listing
    WHEN 'new_event' THEN np.new_event
    WHEN 'new_newsletter' THEN np.new_newsletter
    WHEN 'admin_new_sponsor' THEN np.admin_new_sponsor
    WHEN 'admin_new_member' THEN np.admin_new_member
    WHEN 'admin_listing_review' THEN np.admin_listing_review
    WHEN 'event_photo' THEN np.event_photo END, true)
  INTO _allowed
  FROM (SELECT _user_id AS uid) x
  LEFT JOIN public.notification_prefs np ON np.user_id = x.uid;

  IF _allowed IS FALSE THEN RETURN 0; END IF;

  INSERT INTO public.notifications (user_id, type, title_en, title_af, body_en, body_af, link, related_id)
  VALUES (_user_id, _type, _title_en, _title_af, _body_en, _body_af, _link, _related_id);
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

-- Past-event photo fan-out. Debounces to one alert per event per hour so a
-- multi-photo upload does not spam every member.
CREATE OR REPLACE FUNCTION public.notify_event_photos(_event_id uuid, _exclude uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ev record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT e.id, e.title, e.title_af, e.starts_at, e.is_published
  INTO ev
  FROM public.events e
  WHERE e.id = _event_id;

  IF ev.id IS NULL OR ev.is_published IS NOT TRUE OR ev.starts_at >= now() THEN
    RETURN 0;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('event_photo'), hashtext(_event_id::text));

  IF EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.type = 'event_photo'
      AND n.related_id = _event_id
      AND n.created_at > now() - interval '1 hour'
  ) THEN
    RETURN 0;
  END IF;

  RETURN public.fanout_notification(
    'event_photo',
    'New photos from a past event',
    'Nuwe fotos van ''n vorige byeenkoms',
    ev.title,
    COALESCE(ev.title_af, ev.title),
    '/events/' || _event_id::text,
    _event_id,
    _exclude
  );
END;
$$;

REVOKE ALL ON FUNCTION public.notify_event_photos(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_event_photos(uuid, uuid) TO authenticated, service_role;
