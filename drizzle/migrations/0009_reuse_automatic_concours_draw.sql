CREATE OR REPLACE FUNCTION public.draw_concours_tiebreak(_event_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _winner uuid; _ids uuid[];
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 PERFORM 1 FROM public.event_concours WHERE event_id=_event_id AND enabled AND results_published_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Competition unavailable or results already published'; END IF;
 PERFORM public.refresh_competition_leader(_event_id,'concours');
 SELECT vehicle_id,tied_vehicle_ids INTO _winner,_ids FROM public.competition_leaders WHERE event_id=_event_id AND competition='concours';
 IF coalesce(cardinality(_ids),0)<2 THEN RAISE EXCEPTION 'There is no exact first-place tie'; END IF;
 RETURN _winner;
END $$;
REVOKE ALL ON FUNCTION public.draw_concours_tiebreak(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.draw_concours_tiebreak(uuid) TO authenticated;
CREATE POLICY admin_competition_leaders ON public.competition_leaders FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));