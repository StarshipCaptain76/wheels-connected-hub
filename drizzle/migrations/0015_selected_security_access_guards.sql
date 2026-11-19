CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) AND (_user_id=auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='admin')); $$;
CREATE OR REPLACE FUNCTION public.profiles_membership_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$ BEGIN
IF auth.role()='service_role' OR public.has_role(auth.uid(),'admin') THEN RETURN NEW; END IF;
IF NEW.membership_status IS DISTINCT FROM OLD.membership_status OR NEW.member_number IS DISTINCT FROM OLD.member_number OR NEW.id IS DISTINCT FROM OLD.id THEN RAISE EXCEPTION 'Only admins can change membership details'; END IF;
RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.profiles_membership_guard() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER profiles_membership_guard BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.profiles_membership_guard();
ALTER POLICY "Signed-in members can untag" ON public.gallery_tags USING (tagged_by=auth.uid() OR tagged_user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION public.poll_option_vote_counts(_poll_ids uuid[])
RETURNS TABLE(option_id uuid,vote_count bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$ SELECT v.option_id,count(*) FROM public.poll_votes v JOIN public.polls p ON p.id=v.poll_id WHERE v.poll_id=ANY(_poll_ids) AND (p.status IN ('open','closed') OR public.has_role(auth.uid(),'admin')) GROUP BY v.option_id; $$;
CREATE OR REPLACE FUNCTION public.notify_user(_user_id uuid,_type text,_title_en text,_title_af text,_body_en text DEFAULT NULL,_body_af text DEFAULT NULL,_link text DEFAULT NULL,_related_id uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$ DECLARE _count integer; _allowed boolean; _name text;
BEGIN
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not allowed'; END IF;
IF _type NOT IN ('photo_tag','new_listing','new_event','new_newsletter','admin_new_sponsor','admin_new_member','admin_listing_review','event_photo') THEN RAISE EXCEPTION 'Invalid notification type'; END IF;
IF NOT public.has_role(auth.uid(),'admin') THEN
 IF _type<>'photo_tag' OR NOT EXISTS(SELECT 1 FROM public.gallery_tags t JOIN public.gallery_items g ON g.id=t.gallery_item_id WHERE t.gallery_item_id=_related_id AND t.tagged_user_id=_user_id AND t.tagged_by=auth.uid() AND g.is_published) THEN RAISE EXCEPTION 'Not allowed'; END IF;
 SELECT coalesce(nullif(display_name,''),'A Just Wheels member') INTO _name FROM public.profiles WHERE id=auth.uid();
 _title_en:='You were tagged in a photo'; _title_af:='Jy is in ''n foto gemerk'; _body_en:=coalesce(_name,'A Just Wheels member')||' tagged you in a club photo.'; _body_af:=coalesce(_name,'A Just Wheels member')||' het jou in ''n klubfoto gemerk.'; _link:='/gallery';
 IF EXISTS(SELECT 1 FROM public.notifications WHERE user_id=_user_id AND type='photo_tag' AND related_id=_related_id) THEN RETURN 0; END IF;
END IF;
SELECT coalesce(CASE _type WHEN 'photo_tag' THEN np.photo_tag WHEN 'new_listing' THEN np.new_listing WHEN 'new_event' THEN np.new_event WHEN 'new_newsletter' THEN np.new_newsletter WHEN 'admin_new_sponsor' THEN np.admin_new_sponsor WHEN 'admin_new_member' THEN np.admin_new_member WHEN 'admin_listing_review' THEN np.admin_listing_review WHEN 'event_photo' THEN np.event_photo END,true) INTO _allowed FROM (SELECT _user_id uid) x LEFT JOIN public.notification_prefs np ON np.user_id=x.uid;
IF _allowed IS FALSE THEN RETURN 0; END IF;
INSERT INTO public.notifications(user_id,type,title_en,title_af,body_en,body_af,link,related_id) VALUES(_user_id,_type,_title_en,_title_af,_body_en,_body_af,_link,_related_id);
GET DIAGNOSTICS _count=ROW_COUNT; RETURN _count;
END $$;
ALTER POLICY "event_photos_select_public" ON public.event_photos USING (user_id=auth.uid() OR public.has_role(auth.uid(),'admin') OR EXISTS(SELECT 1 FROM public.events e WHERE e.id=event_photos.event_id AND e.is_published));
ALTER POLICY "events_insert_auth" ON storage.objects WITH CHECK (bucket_id='events' AND public.has_role(auth.uid(),'admin'));