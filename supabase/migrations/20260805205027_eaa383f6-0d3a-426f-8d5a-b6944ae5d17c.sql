CREATE OR REPLACE FUNCTION public.fanout_notification(_type text,_title_en text,_title_af text,_body_en text DEFAULT NULL,_body_af text DEFAULT NULL,_link text DEFAULT NULL,_related_id uuid DEFAULT NULL,_exclude uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _count integer;
BEGIN
  IF _type NOT IN ('new_listing','new_event','new_newsletter','admin_new_sponsor','admin_new_member','admin_listing_review','photo_tag') THEN
    RAISE EXCEPTION 'Unknown notification type %', _type;
  END IF;
  IF auth.uid() IS NULL AND _type NOT IN ('admin_new_member','admin_new_sponsor') THEN
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