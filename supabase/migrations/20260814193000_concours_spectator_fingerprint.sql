-- Spectator device fingerprint + published-result snapshot.
-- Member uniqueness stays on (event_id, vehicle_id, user_id);
-- unsigned spectators are unique on (event_id, vehicle_id, voter_fingerprint).

ALTER TABLE public.event_concours_scores
  ADD COLUMN IF NOT EXISTS voter_fingerprint text;

ALTER TABLE public.event_concours
  ADD COLUMN IF NOT EXISTS winner_average_score numeric,
  ADD COLUMN IF NOT EXISTS winner_submission_count integer;

CREATE UNIQUE INDEX IF NOT EXISTS event_concours_scores_member_uniq
  ON public.event_concours_scores (event_id, vehicle_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS event_concours_scores_voter_uniq
  ON public.event_concours_scores (event_id, vehicle_id, voter_fingerprint)
  WHERE voter_fingerprint IS NOT NULL;

CREATE OR REPLACE FUNCTION public.concours_scores_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _derived_member boolean := false;
  _max_weight numeric := 0.5;
  _jwt_role text := COALESCE(auth.jwt() ->> 'role', '');
BEGIN
  -- Trusted server writes (service role) already validated membership / GPS / window.
  IF _jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS NOT NULL AND NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You can only submit your own score';
  END IF;

  IF auth.uid() IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.membership_status IN ('active', 'member')
    ) INTO _derived_member;
  END IF;

  NEW.is_member := COALESCE(NEW.is_member, false) AND _derived_member;
  _max_weight := CASE WHEN NEW.is_member THEN 1.0 ELSE 0.5 END;
  NEW.weight := LEAST(GREATEST(COALESCE(NEW.weight, _max_weight), 0), _max_weight);

  RETURN NEW;
END;
$$;
