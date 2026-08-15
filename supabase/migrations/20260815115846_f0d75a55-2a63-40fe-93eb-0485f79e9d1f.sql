-- Which vehicles has this voter already scored?
CREATE OR REPLACE FUNCTION public.concours_scored_vehicles(_event_id uuid, _fingerprint text DEFAULT NULL)
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.vehicle_id
  FROM public.event_concours_scores s
  WHERE s.event_id = _event_id
    AND (
      (auth.uid() IS NOT NULL AND s.user_id = auth.uid())
      OR (_fingerprint IS NOT NULL AND s.voter_fingerprint = _fingerprint)
    )
$$;

REVOKE ALL ON FUNCTION public.concours_scored_vehicles(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.concours_scored_vehicles(uuid, text) TO anon, authenticated, service_role;

-- Spectator score submit (no service role needed)
CREATE OR REPLACE FUNCTION public.submit_concours_spectator_score(
  _event_id uuid,
  _vehicle_id uuid,
  _fingerprint text,
  _answers jsonb,
  _total numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _enabled boolean;
BEGIN
  IF _fingerprint IS NULL OR length(_fingerprint) < 16 THEN
    RAISE EXCEPTION 'Invalid voter key';
  END IF;

  SELECT ec.enabled AND ec.results_published_at IS NULL INTO _enabled
  FROM public.event_concours ec WHERE ec.event_id = _event_id;
  IF NOT COALESCE(_enabled, false) THEN
    RAISE EXCEPTION 'Scoring is closed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.event_concours_vehicles v
    WHERE v.id = _vehicle_id AND v.event_id = _event_id
  ) THEN
    RAISE EXCEPTION 'Vehicle is not part of this event';
  END IF;

  INSERT INTO public.event_concours_scores
    (event_id, vehicle_id, user_id, is_member, weight, answers, total_score, voter_fingerprint, submitted_at)
  VALUES (_event_id, _vehicle_id, NULL, false, 0.5, COALESCE(_answers, '{}'::jsonb), _total, _fingerprint, now())
  ON CONFLICT (event_id, vehicle_id, voter_fingerprint) WHERE voter_fingerprint IS NOT NULL
  DO UPDATE SET answers = EXCLUDED.answers, total_score = EXCLUDED.total_score, submitted_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.submit_concours_spectator_score(uuid, uuid, text, jsonb, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_concours_spectator_score(uuid, uuid, text, jsonb, numeric) TO anon, authenticated, service_role;

-- Concours vehicle photos readable by everyone while the concours is enabled
DROP POLICY IF EXISTS gallery_public_read_concours_photos ON storage.objects;
CREATE POLICY gallery_public_read_concours_photos
ON storage.objects FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'gallery'
  AND EXISTS (
    SELECT 1
    FROM public.event_concours_vehicles v
    JOIN public.event_concours ec ON ec.event_id = v.event_id
    WHERE ec.enabled = true AND v.photo_url LIKE ('%' || objects.name)
  )
);