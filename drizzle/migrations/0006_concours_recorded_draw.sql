CREATE OR REPLACE FUNCTION public.draw_concours_tiebreak(_event_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ec public.event_concours; _ids uuid[]; _best numeric; _winner uuid;
BEGIN
 IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 SELECT * INTO _ec FROM public.event_concours WHERE event_id = _event_id FOR UPDATE;
 IF NOT FOUND OR NOT _ec.enabled OR _ec.results_published_at IS NOT NULL THEN RAISE EXCEPTION 'Competition unavailable or results already published'; END IF;
 WITH ranked AS (SELECT vehicle_id, sum(total_score * weight) / nullif(sum(weight),0) AS score FROM public.event_concours_scores WHERE event_id = _event_id AND weight > 0 AND total_score IS NOT NULL GROUP BY vehicle_id)
 SELECT max(score) INTO _best FROM ranked;
 WITH ranked AS (SELECT vehicle_id, sum(total_score * weight) / nullif(sum(weight),0) AS score FROM public.event_concours_scores WHERE event_id = _event_id AND weight > 0 AND total_score IS NOT NULL GROUP BY vehicle_id)
 SELECT array_agg(vehicle_id ORDER BY vehicle_id) INTO _ids FROM ranked WHERE abs(score - _best) < 0.0000000001;
 IF coalesce(cardinality(_ids),0) < 2 THEN RAISE EXCEPTION 'There is no exact first-place tie'; END IF;
 IF _ec.tiebreak_vehicle_ids = _ids AND abs(_ec.tiebreak_score - _best) < 0.0000000001 AND _ec.tiebreak_winner_vehicle_id = ANY(_ids) THEN RETURN _ec.tiebreak_winner_vehicle_id; END IF;
 SELECT id INTO _winner FROM unnest(_ids) id ORDER BY random() LIMIT 1;
 UPDATE public.event_concours SET tiebreak_vehicle_ids = _ids, tiebreak_winner_vehicle_id = _winner, tiebreak_score = _best, tiebreak_drawn_at = now(), tiebreak_drawn_by = auth.uid() WHERE event_id = _event_id;
 RETURN _winner;
END $$;
REVOKE ALL ON FUNCTION public.draw_concours_tiebreak(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.draw_concours_tiebreak(uuid) TO authenticated;