
-- event_concours
DROP POLICY IF EXISTS "Anyone can read enabled event concours" ON public.event_concours;
CREATE POLICY "Public can read enabled event concours" ON public.event_concours FOR SELECT TO anon USING (enabled = true);
CREATE POLICY "Members can read enabled or admin event concours" ON public.event_concours FOR SELECT TO authenticated USING (enabled = true OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Admins can manage event concours" ON public.event_concours;
CREATE POLICY "Admins can manage event concours" ON public.event_concours FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- event_concours_vehicles
DROP POLICY IF EXISTS "Admins can manage concours vehicles" ON public.event_concours_vehicles;
CREATE POLICY "Admins can manage concours vehicles" ON public.event_concours_vehicles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Members can tag concours vehicles" ON public.event_concours_vehicles;
CREATE POLICY "Members can tag concours vehicles" ON public.event_concours_vehicles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.event_concours ec WHERE ec.event_id = event_concours_vehicles.event_id AND ec.enabled = true))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.event_concours ec WHERE ec.event_id = event_concours_vehicles.event_id AND ec.enabled = true));

-- event_concours_scores
DROP POLICY IF EXISTS "Admins can manage all scores" ON public.event_concours_scores;
CREATE POLICY "Admins can manage all scores" ON public.event_concours_scores FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Users can read scores for revealed leaderboards or own scores" ON public.event_concours_scores;
CREATE POLICY "Public can read revealed scores" ON public.event_concours_scores FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.event_concours ec WHERE ec.event_id = event_concours_scores.event_id AND ec.leaderboard_revealed = true));
CREATE POLICY "Members read revealed or own scores" ON public.event_concours_scores FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.event_concours ec WHERE ec.event_id = event_concours_scores.event_id AND ec.leaderboard_revealed = true) OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Users can insert their own scores" ON public.event_concours_scores;
CREATE POLICY "Users can insert their own scores" ON public.event_concours_scores FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- event_checkins
DROP POLICY IF EXISTS "Admins manage checkins" ON public.event_checkins;
CREATE POLICY "Admins manage checkins" ON public.event_checkins FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Users read own checkins" ON public.event_checkins;
CREATE POLICY "Users read own checkins" ON public.event_checkins FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Users insert own checkin" ON public.event_checkins;
CREATE POLICY "Users insert own checkin" ON public.event_checkins FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own checkin" ON public.event_checkins;
CREATE POLICY "Users update own checkin" ON public.event_checkins FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- concours_questions
DROP POLICY IF EXISTS "Admins manage concours questions" ON public.concours_questions;
CREATE POLICY "Admins manage concours questions" ON public.concours_questions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
