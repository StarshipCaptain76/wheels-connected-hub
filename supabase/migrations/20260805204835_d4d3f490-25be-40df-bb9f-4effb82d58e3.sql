
-- 1. Member email mirror (admin-visible only)
CREATE TABLE IF NOT EXISTS public.member_emails (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.member_emails TO authenticated;
GRANT ALL ON public.member_emails TO service_role;
ALTER TABLE public.member_emails ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS member_emails_admin_read ON public.member_emails;
CREATE POLICY member_emails_admin_read ON public.member_emails FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS member_emails_read_own ON public.member_emails;
CREATE POLICY member_emails_read_own ON public.member_emails FOR SELECT TO authenticated
  USING (user_id = auth.uid());

INSERT INTO public.member_emails (user_id, email)
SELECT u.id, u.email FROM auth.users u
ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, updated_at = now();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.member_emails (user_id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, updated_at = now();

  PERFORM public.grant_admin_if_allowlisted(NEW.id, NEW.email, NEW.email_confirmed_at);

  RETURN NEW;
END;
$$;

-- 2. Notification fan-out
CREATE OR REPLACE FUNCTION public.fanout_notification(
  _type text,
  _title_en text,
  _title_af text,
  _body_en text DEFAULT NULL,
  _body_af text DEFAULT NULL,
  _link text DEFAULT NULL,
  _related_id uuid DEFAULT NULL,
  _exclude uuid DEFAULT NULL
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _count integer;
BEGIN
  IF _type NOT IN ('new_listing','new_event','new_newsletter','admin_new_sponsor','admin_new_member','admin_listing_review','photo_tag') THEN
    RAISE EXCEPTION 'Unknown notification type %', _type;
  END IF;
  IF auth.uid() IS NULL AND _type <> 'admin_new_member' THEN
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
        WHEN 'photo_tag' THEN np.photo_tag END, true)
  )
  INSERT INTO public.notifications (user_id, type, title_en, title_af, body_en, body_af, link, related_id)
  SELECT id, _type, _title_en, _title_af, _body_en, _body_af, _link, _related_id FROM filtered;

  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;
REVOKE ALL ON FUNCTION public.fanout_notification(text,text,text,text,text,text,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fanout_notification(text,text,text,text,text,text,uuid,uuid) TO anon, authenticated, service_role;

-- 3. Notify a single member (respects their preference)
CREATE OR REPLACE FUNCTION public.notify_user(
  _user_id uuid,
  _type text,
  _title_en text,
  _title_af text,
  _body_en text DEFAULT NULL,
  _body_af text DEFAULT NULL,
  _link text DEFAULT NULL,
  _related_id uuid DEFAULT NULL
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _count integer; _allowed boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF _type NOT IN ('photo_tag','new_listing','new_event','new_newsletter','admin_new_sponsor','admin_new_member','admin_listing_review') THEN
    RAISE EXCEPTION 'Unknown notification type %', _type;
  END IF;

  SELECT COALESCE(CASE _type
    WHEN 'photo_tag' THEN np.photo_tag
    WHEN 'new_listing' THEN np.new_listing
    WHEN 'new_event' THEN np.new_event
    WHEN 'new_newsletter' THEN np.new_newsletter
    WHEN 'admin_new_sponsor' THEN np.admin_new_sponsor
    WHEN 'admin_new_member' THEN np.admin_new_member
    WHEN 'admin_listing_review' THEN np.admin_listing_review END, true)
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
REVOKE ALL ON FUNCTION public.notify_user(uuid,text,text,text,text,text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_user(uuid,text,text,text,text,text,text,uuid) TO authenticated, service_role;

-- 4. Newsletter subscribe / unsubscribe
CREATE OR REPLACE FUNCTION public.newsletter_subscribe(_email text, _lang text DEFAULT 'en', _source text DEFAULT 'footer')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _token uuid;
BEGIN
  IF _lang NOT IN ('en','af') THEN _lang := 'en'; END IF;
  IF _email IS NULL OR char_length(_email) < 3 OR char_length(_email) > 254 THEN
    RAISE EXCEPTION 'Invalid email';
  END IF;

  SELECT unsubscribe_token INTO _token FROM public.newsletter_subscribers WHERE email = _email::citext;
  IF _token IS NULL THEN
    INSERT INTO public.newsletter_subscribers (email, lang, source)
    VALUES (_email::citext, _lang, left(COALESCE(_source,'footer'), 60))
    RETURNING unsubscribe_token INTO _token;
  ELSE
    UPDATE public.newsletter_subscribers
      SET unsubscribed_at = NULL, lang = _lang
      WHERE email = _email::citext;
  END IF;
  RETURN _token;
END;
$$;
REVOKE ALL ON FUNCTION public.newsletter_subscribe(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.newsletter_subscribe(text,text,text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.newsletter_unsubscribe(_token uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _email text;
BEGIN
  UPDATE public.newsletter_subscribers
    SET unsubscribed_at = now()
    WHERE unsubscribe_token = _token
    RETURNING email::text INTO _email;
  RETURN _email;
END;
$$;
REVOKE ALL ON FUNCTION public.newsletter_unsubscribe(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.newsletter_unsubscribe(uuid) TO anon, authenticated, service_role;

-- 5. RSVP from an emailed invite link
CREATE OR REPLACE FUNCTION public.rsvp_via_invite(_token uuid, _response text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _invite record;
BEGIN
  IF _response NOT IN ('going','maybe','not_going') THEN RAISE EXCEPTION 'Invalid response'; END IF;
  SELECT id, event_id, user_id INTO _invite FROM public.event_invites WHERE token = _token;
  IF _invite.id IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.event_rsvps (event_id, user_id, status, party_size)
  VALUES (_invite.event_id, _invite.user_id, _response::rsvp_status, 1)
  ON CONFLICT (event_id, user_id) DO UPDATE SET status = EXCLUDED.status, updated_at = now();

  UPDATE public.event_invites SET response = _response, responded_at = now() WHERE id = _invite.id;
  RETURN _invite.event_id;
END;
$$;
REVOKE ALL ON FUNCTION public.rsvp_via_invite(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rsvp_via_invite(uuid,text) TO anon, authenticated, service_role;

-- 6. Route cache write
CREATE OR REPLACE FUNCTION public.route_cache_put(_key text, _payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not allowed'; END IF;
  INSERT INTO public.route_cache (cache_key, payload)
  VALUES (_key, _payload)
  ON CONFLICT (cache_key) DO UPDATE SET payload = EXCLUDED.payload, created_at = now(), expires_at = now() + interval '30 days';
END;
$$;
REVOKE ALL ON FUNCTION public.route_cache_put(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.route_cache_put(text,jsonb) TO authenticated, service_role;

-- 7. Daily featured member card (public, narrow columns)
CREATE OR REPLACE FUNCTION public.featured_member_card()
RETURNS TABLE (
  id uuid,
  display_name text,
  member_number integer,
  town text,
  favourite_ride text,
  featured_bio text,
  featured_photo_url text,
  avatar_url text,
  featured_since timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT p.id, p.display_name, p.member_number, p.town, p.favourite_ride,
         p.featured_bio, p.featured_photo_url, p.avatar_url, p.featured_since
  FROM public.profiles p
  WHERE p.id = public.daily_featured_id()
$$;
REVOKE ALL ON FUNCTION public.featured_member_card() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.featured_member_card() TO anon, authenticated, service_role;
