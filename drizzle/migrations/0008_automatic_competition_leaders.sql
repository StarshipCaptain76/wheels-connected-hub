CREATE TABLE public.competition_leaders (
 event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
 competition text NOT NULL CHECK (competition IN ('concours','idle')),
 vehicle_id uuid NOT NULL REFERENCES public.event_concours_vehicles(id) ON DELETE CASCADE,
 score numeric NOT NULL,
 submission_count integer NOT NULL,
 tied_vehicle_ids uuid[] NOT NULL,
 drawn_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(event_id,competition)
);
GRANT SELECT ON public.competition_leaders TO anon, authenticated;
GRANT ALL ON public.competition_leaders TO service_role;
ALTER TABLE public.competition_leaders ENABLE ROW LEVEL SECURITY;
CREATE POLICY published_concours_leaders ON public.competition_leaders FOR SELECT TO anon, authenticated USING (competition='concours' AND EXISTS(SELECT 1 FROM public.events e JOIN public.event_concours ec ON ec.event_id=e.id WHERE e.id=competition_leaders.event_id AND e.is_published AND ec.enabled));
CREATE POLICY member_idle_leaders ON public.competition_leaders FOR SELECT TO authenticated USING (competition='idle' AND (public.has_role(auth.uid(),'admin') OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.membership_status IN ('active','member'))) AND EXISTS(SELECT 1 FROM public.events e JOIN public.event_concours ec ON ec.event_id=e.id WHERE e.id=competition_leaders.event_id AND e.is_published AND ec.idle_test_enabled));
CREATE OR REPLACE FUNCTION public.refresh_competition_leader(_event_id uuid,_competition text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _ids uuid[]; _best numeric; _winner uuid; _count integer; _old public.competition_leaders;
BEGIN
 PERFORM 1 FROM public.event_concours WHERE event_id=_event_id FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 IF _competition='concours' THEN
  WITH ranked AS (SELECT s.vehicle_id,sum(s.total_score*s.weight)/nullif(sum(s.weight),0) score FROM public.event_concours_scores s WHERE s.event_id=_event_id AND s.weight>0 AND s.total_score IS NOT NULL GROUP BY s.vehicle_id)
  SELECT max(score) INTO _best FROM ranked;
  WITH ranked AS (SELECT s.vehicle_id,sum(s.total_score*s.weight)/nullif(sum(s.weight),0) score FROM public.event_concours_scores s WHERE s.event_id=_event_id AND s.weight>0 AND s.total_score IS NOT NULL GROUP BY s.vehicle_id)
  SELECT array_agg(vehicle_id ORDER BY vehicle_id) INTO _ids FROM ranked WHERE score=_best;
 ELSE
  SELECT max(smooth01) INTO _best FROM public.event_idle_tests WHERE event_id=_event_id AND valid AND NOT superseded;
  SELECT array_agg(DISTINCT vehicle_id ORDER BY vehicle_id) INTO _ids FROM public.event_idle_tests WHERE event_id=_event_id AND valid AND NOT superseded AND smooth01=_best;
 END IF;
 IF _best IS NULL OR coalesce(cardinality(_ids),0)=0 THEN
  DELETE FROM public.competition_leaders WHERE event_id=_event_id AND competition=_competition; RETURN;
 END IF;
 SELECT * INTO _old FROM public.competition_leaders WHERE event_id=_event_id AND competition=_competition;
 IF _old.tied_vehicle_ids=_ids AND _old.score=_best AND _old.vehicle_id=ANY(_ids) THEN _winner:=_old.vehicle_id;
 ELSE SELECT id INTO _winner FROM unnest(_ids) id ORDER BY random() LIMIT 1; END IF;
 IF _competition='concours' THEN SELECT count(*) INTO _count FROM public.event_concours_scores WHERE event_id=_event_id AND vehicle_id=_winner AND weight>0 AND total_score IS NOT NULL;
 ELSE SELECT count(*) INTO _count FROM public.event_idle_tests WHERE event_id=_event_id AND vehicle_id=_winner AND valid AND NOT superseded; END IF;
 INSERT INTO public.competition_leaders(event_id,competition,vehicle_id,score,submission_count,tied_vehicle_ids,drawn_at) VALUES(_event_id,_competition,_winner,_best,_count,_ids,CASE WHEN cardinality(_ids)>1 THEN CASE WHEN _old.tied_vehicle_ids=_ids AND _old.score=_best THEN _old.drawn_at ELSE now() END ELSE NULL END)
 ON CONFLICT(event_id,competition) DO UPDATE SET vehicle_id=EXCLUDED.vehicle_id,score=EXCLUDED.score,submission_count=EXCLUDED.submission_count,tied_vehicle_ids=EXCLUDED.tied_vehicle_ids,drawn_at=EXCLUDED.drawn_at,updated_at=now();
 IF _competition='concours' THEN
 UPDATE public.event_concours SET tiebreak_vehicle_ids=CASE WHEN cardinality(_ids)>1 THEN _ids ELSE '{}'::uuid[] END,tiebreak_winner_vehicle_id=CASE WHEN cardinality(_ids)>1 THEN _winner ELSE NULL END,tiebreak_score=CASE WHEN cardinality(_ids)>1 THEN _best ELSE NULL END,tiebreak_drawn_at=CASE WHEN cardinality(_ids)>1 THEN (SELECT drawn_at FROM public.competition_leaders WHERE event_id=_event_id AND competition=_competition) ELSE NULL END,tiebreak_drawn_by=NULL WHERE event_id=_event_id AND results_published_at IS NULL;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.refresh_competition_leader(uuid,text) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.competition_leader_after_score() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='DELETE' THEN PERFORM public.refresh_competition_leader(OLD.event_id,TG_ARGV[0]); RETURN OLD; END IF;
 PERFORM public.refresh_competition_leader(NEW.event_id,TG_ARGV[0]);
 IF TG_OP='UPDATE' AND OLD.event_id<>NEW.event_id THEN PERFORM public.refresh_competition_leader(OLD.event_id,TG_ARGV[0]); END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.competition_leader_after_score() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER concours_live_leader AFTER INSERT OR UPDATE OR DELETE ON public.event_concours_scores FOR EACH ROW EXECUTE FUNCTION public.competition_leader_after_score('concours');
CREATE TRIGGER idle_live_leader AFTER INSERT OR DELETE OR UPDATE OF smooth01,valid,superseded,vehicle_id,event_id ON public.event_idle_tests FOR EACH ROW EXECUTE FUNCTION public.competition_leader_after_score('idle');
INSERT INTO public.competition_leaders(event_id,competition,vehicle_id,score,submission_count,tied_vehicle_ids,drawn_at)
WITH ranked AS (
 SELECT event_id,'concours'::text competition,vehicle_id,sum(total_score*weight)/sum(weight) score,count(*)::integer submission_count FROM public.event_concours_scores WHERE total_score IS NOT NULL AND weight>0 GROUP BY event_id,vehicle_id
 UNION ALL SELECT event_id,'idle',vehicle_id,max(smooth01),count(*)::integer FROM public.event_idle_tests WHERE valid AND NOT superseded AND smooth01 IS NOT NULL GROUP BY event_id,vehicle_id
), best AS (SELECT *,max(score) OVER(PARTITION BY event_id,competition) top_score FROM ranked), ties AS (SELECT event_id,competition,array_agg(vehicle_id ORDER BY vehicle_id) ids FROM best WHERE score=top_score GROUP BY event_id,competition), picked AS (SELECT b.*,t.ids,row_number() OVER(PARTITION BY b.event_id,b.competition ORDER BY random()) pick FROM best b JOIN ties t USING(event_id,competition) WHERE b.score=b.top_score)
SELECT event_id,competition,vehicle_id,score,submission_count,ids,CASE WHEN cardinality(ids)>1 THEN now() ELSE NULL END FROM picked WHERE pick=1;