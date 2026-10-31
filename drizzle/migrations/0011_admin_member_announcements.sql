CREATE UNIQUE INDEX notifications_announcement_delivery ON public.notifications(user_id,related_id) WHERE type='announcement' AND related_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.send_member_announcement(_request_id uuid,_title_en text,_body_en text,_title_af text DEFAULT NULL,_body_af text DEFAULT NULL) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _count integer;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Only admins can send member announcements'; END IF;
 IF _request_id IS NULL OR length(trim(coalesce(_title_en,''))) NOT BETWEEN 1 AND 120 OR length(trim(coalesce(_body_en,''))) NOT BETWEEN 1 AND 2000 OR length(coalesce(_title_af,''))>120 OR length(coalesce(_body_af,''))>2000 THEN RAISE EXCEPTION 'Enter a valid announcement title and message'; END IF;
 INSERT INTO public.notifications(user_id,type,title_en,title_af,body_en,body_af,related_id)
 SELECT p.id,'announcement',trim(_title_en),coalesce(nullif(trim(_title_af),''),trim(_title_en)),trim(_body_en),coalesce(nullif(trim(_body_af),''),trim(_body_en)),_request_id
 FROM public.profiles p WHERE p.membership_status IN ('active','member')
 ON CONFLICT(user_id,related_id) WHERE type='announcement' AND related_id IS NOT NULL DO NOTHING;
 SELECT count(*) INTO _count FROM public.notifications WHERE type='announcement' AND related_id=_request_id;
 RETURN _count;
END $$;
REVOKE ALL ON FUNCTION public.send_member_announcement(uuid,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.send_member_announcement(uuid,text,text,text,text) TO authenticated;