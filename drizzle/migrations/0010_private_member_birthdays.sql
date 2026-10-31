CREATE TABLE public.member_birthdays (
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 birthday_month integer NOT NULL CHECK(birthday_month BETWEEN 1 AND 12),
 birthday_day integer NOT NULL CHECK(birthday_day BETWEEN 1 AND EXTRACT(day FROM (make_date(2000,birthday_month,1)+interval '1 month - 1 day'))::integer)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.member_birthdays TO authenticated;
GRANT ALL ON public.member_birthdays TO service_role;
ALTER TABLE public.member_birthdays ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_or_admin_birthdays ON public.member_birthdays FOR ALL TO authenticated USING(user_id=(select auth.uid()) OR public.has_role((select auth.uid()),'admin')) WITH CHECK(user_id=(select auth.uid()) OR public.has_role((select auth.uid()),'admin'));
COMMENT ON TABLE public.member_birthdays IS 'Private profile birthday day/month, visible only to the member and club admins; no birth year is collected.';