-- Rolls-Royce Start & Idle Test (Concours Mini add-on) — Phase 1 schema.
-- Idempotent: ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS.

ALTER TABLE public.event_concours
  ADD COLUMN IF NOT EXISTS idle_test_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS idle_test_revealed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS idle_rr_standard_smooth01 numeric(6,4),
  ADD COLUMN IF NOT EXISTS idle_rr_standard_vehicle_id uuid,
  ADD COLUMN IF NOT EXISTS idle_prize_en text,
  ADD COLUMN IF NOT EXISTS idle_prize_af text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_concours_idle_rr_standard_vehicle_id_fkey'
  ) THEN
    ALTER TABLE public.event_concours
      ADD CONSTRAINT event_concours_idle_rr_standard_vehicle_id_fkey
      FOREIGN KEY (idle_rr_standard_vehicle_id)
      REFERENCES public.event_concours_vehicles(id)
      ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.event_concours_vehicles
  ADD COLUMN IF NOT EXISTS vehicle_year integer,
  ADD COLUMN IF NOT EXISTS vehicle_make text,
  ADD COLUMN IF NOT EXISTS vehicle_model text,
  ADD COLUMN IF NOT EXISTS powertrain text;

CREATE TABLE IF NOT EXISTS public.event_idle_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.event_concours_vehicles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  valid boolean NOT NULL DEFAULT true,
  superseded boolean NOT NULL DEFAULT false,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  samples jsonb,
  start_detected boolean,
  vehicle_year integer,
  powertrain text,
  era_slack numeric(6,4),
  powertrain_slack numeric(6,4),
  slack numeric(6,4),
  raw_harsh numeric,
  adjusted_harsh numeric,
  smooth01 numeric(6,4),
  display_score numeric(4,1),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS event_idle_tests_official_uniq
  ON public.event_idle_tests (event_id, vehicle_id)
  WHERE valid AND NOT superseded;

CREATE INDEX IF NOT EXISTS event_idle_tests_event_id_idx
  ON public.event_idle_tests (event_id);

CREATE INDEX IF NOT EXISTS event_idle_tests_vehicle_id_idx
  ON public.event_idle_tests (vehicle_id);

ALTER TABLE public.event_idle_tests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members insert own idle tests" ON public.event_idle_tests;
CREATE POLICY "Members insert own idle tests"
ON public.event_idle_tests FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Members update own idle tests" ON public.event_idle_tests;
CREATE POLICY "Members update own idle tests"
ON public.event_idle_tests FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Read own or revealed idle tests" ON public.event_idle_tests;
CREATE POLICY "Read own or revealed idle tests"
ON public.event_idle_tests FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.event_concours ec
    WHERE ec.event_id = event_idle_tests.event_id
      AND ec.idle_test_revealed = true
  )
);

DROP POLICY IF EXISTS "Public read revealed idle tests" ON public.event_idle_tests;
CREATE POLICY "Public read revealed idle tests"
ON public.event_idle_tests FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.event_concours ec
    WHERE ec.event_id = event_idle_tests.event_id
      AND ec.idle_test_revealed = true
  )
);

DROP POLICY IF EXISTS "Admins manage idle tests" ON public.event_idle_tests;
CREATE POLICY "Admins manage idle tests"
ON public.event_idle_tests FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

GRANT SELECT, INSERT, UPDATE ON public.event_idle_tests TO authenticated;
GRANT SELECT ON public.event_idle_tests TO anon;

-- Recompute the Rolls-Royce standard (smoothest official run) and rewrite
-- every official display_score. SECURITY DEFINER so a member submit can
-- rescale other cars without UPDATE rights on those rows.
CREATE OR REPLACE FUNCTION public.recompute_idle_rr_standard(_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _std numeric(6,4);
  _vid uuid;
BEGIN
  SELECT t.smooth01, t.vehicle_id
    INTO _std, _vid
  FROM public.event_idle_tests t
  WHERE t.event_id = _event_id AND t.valid AND NOT t.superseded
  ORDER BY t.smooth01 DESC NULLS LAST, t.created_at ASC
  LIMIT 1;

  UPDATE public.event_concours
  SET idle_rr_standard_smooth01 = _std,
      idle_rr_standard_vehicle_id = _vid,
      updated_at = now()
  WHERE event_id = _event_id;

  IF _std IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.event_idle_tests t
  SET display_score = GREATEST(
        1::numeric,
        LEAST(
          10::numeric,
          ROUND((10 * t.smooth01 / GREATEST(_std, 0.000001))::numeric, 1)
        )
      )
  WHERE t.event_id = _event_id AND t.valid AND NOT t.superseded;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_idle_rr_standard(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recompute_idle_rr_standard(uuid) TO authenticated;
