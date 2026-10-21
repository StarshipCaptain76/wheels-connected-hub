CREATE OR REPLACE FUNCTION public.validate_concours_question_total()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _entry record; _type text; _sum numeric := 0; _n integer := 0; _v numeric; _text text;
BEGIN
 IF jsonb_typeof(NEW.answers) IS DISTINCT FROM 'object' OR NEW.answers = '{}'::jsonb THEN RAISE EXCEPTION 'Answers are required'; END IF;
 FOR _entry IN SELECT key, value FROM jsonb_each(NEW.answers) LOOP
   SELECT scoring_type INTO _type FROM public.concours_questions WHERE id::text = _entry.key;
   IF NOT FOUND THEN RAISE EXCEPTION 'Unknown question'; END IF;
   _text := _entry.value #>> '{}';
   IF _type = 'yes_no_na' AND _text = 'na' THEN CONTINUE; END IF;
   IF _type IN ('yes_no', 'yes_no_na') THEN
     IF jsonb_typeof(_entry.value) <> 'string' OR _text NOT IN ('yes','no') THEN RAISE EXCEPTION 'Invalid yes/no answer'; END IF;
     _v := CASE WHEN _text = 'yes' THEN 10 ELSE 0 END;
   ELSE
     IF jsonb_typeof(_entry.value) <> 'number' THEN RAISE EXCEPTION 'Numeric answer required'; END IF;
     _v := _text::numeric;
     IF _v <> trunc(_v) OR _v > 10 OR _v < (CASE WHEN _type = 'count' THEN 0 ELSE 1 END) THEN RAISE EXCEPTION 'Answer out of range'; END IF;
   END IF;
   _sum := _sum + _v; _n := _n + 1;
 END LOOP;
 IF _n = 0 THEN RAISE EXCEPTION 'At least one scored answer is required'; END IF;
 NEW.total_score := _sum / _n;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.validate_concours_question_total() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER validate_concours_question_total BEFORE INSERT ON public.event_concours_scores FOR EACH ROW EXECUTE FUNCTION public.validate_concours_question_total();