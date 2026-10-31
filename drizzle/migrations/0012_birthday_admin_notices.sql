ALTER TABLE public.member_birthdays ADD COLUMN IF NOT EXISTS admin_notified_on date;
CREATE OR REPLACE FUNCTION public.birthday_admin_notices_due(_key text)
RETURNS TABLE(member_id uuid, display_name text, member_number integer, town text, phone text, favourite_ride text, bio text, birthday_day integer, birthday_month integer, recipient_email text, recipient_lang text, notice_date date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE today date := (now() AT TIME ZONE 'Africa/Johannesburg')::date;
BEGIN
 IF NOT public.cron_key_ok('event_reminders', _key) THEN RAISE EXCEPTION 'Not allowed'; END IF;
 RETURN QUERY
 SELECT p.id,p.display_name,p.member_number,p.town,p.phone,p.favourite_ride,p.featured_bio,b.birthday_day,b.birthday_month,u.email::text,ap.preferred_lang,today
 FROM public.member_birthdays b JOIN public.profiles p ON p.id=b.user_id
 CROSS JOIN public.user_roles r JOIN auth.users u ON u.id=r.user_id LEFT JOIN public.profiles ap ON ap.id=r.user_id
 WHERE r.role='admin' AND u.email IS NOT NULL AND p.membership_status IN ('active','member')
 AND b.birthday_month=extract(month FROM today)::int AND b.birthday_day=extract(day FROM today)::int
 AND b.admin_notified_on IS DISTINCT FROM today
 ORDER BY p.member_number,u.email;
END;
$$;
REVOKE ALL ON FUNCTION public.birthday_admin_notices_due(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.birthday_admin_notices_due(text) TO anon, authenticated;
CREATE OR REPLACE FUNCTION public.complete_birthday_admin_notice(_key text,_member_id uuid,_notice_date date)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public
AS $$
DECLARE today date := (now() AT TIME ZONE 'Africa/Johannesburg')::date;
BEGIN
 IF NOT public.cron_key_ok('event_reminders',_key) OR _notice_date IS DISTINCT FROM today THEN RAISE EXCEPTION 'Not allowed'; END IF;
 UPDATE public.member_birthdays SET admin_notified_on=today WHERE user_id=_member_id AND birthday_month=extract(month FROM today)::int AND birthday_day=extract(day FROM today)::int;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_birthday_admin_notice(text,uuid,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_birthday_admin_notice(text,uuid,date) TO anon,authenticated;
COMMENT ON COLUMN public.member_birthdays.admin_notified_on IS 'Last successful birthday admin notice date in Africa/Johannesburg; protected by the existing owner/admin RLS.';