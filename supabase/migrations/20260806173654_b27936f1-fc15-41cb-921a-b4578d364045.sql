-- 1) Concours scores: derive is_member / weight server-side, cap client values
CREATE OR REPLACE FUNCTION public.concours_scores_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _derived_member boolean := false;
  _max_weight numeric := 0.5;
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- A score row must belong to the caller (or be anonymous/spectator)
  IF NEW.user_id IS NOT NULL AND NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You can only submit your own score';
  END IF;

  IF auth.uid() IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.membership_status = 'active'
    ) INTO _derived_member;
  END IF;

  -- Client may declare spectator status (lower weight) but never elevate
  NEW.is_member := COALESCE(NEW.is_member, false) AND _derived_member;
  _max_weight := CASE WHEN NEW.is_member THEN 1.0 ELSE 0.5 END;
  NEW.weight := LEAST(GREATEST(COALESCE(NEW.weight, _max_weight), 0), _max_weight);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_concours_scores_guard ON public.event_concours_scores;
CREATE TRIGGER event_concours_scores_guard
BEFORE INSERT OR UPDATE ON public.event_concours_scores
FOR EACH ROW EXECUTE FUNCTION public.concours_scores_guard();

-- 2) Concours vehicles: restrict which rows and which columns a member may change
DROP POLICY IF EXISTS "Members can tag concours vehicles" ON public.event_concours_vehicles;
CREATE POLICY "Members can tag concours vehicles"
ON public.event_concours_vehicles
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (
    EXISTS (
      SELECT 1 FROM public.event_concours ec
      WHERE ec.event_id = event_concours_vehicles.event_id AND ec.enabled = true
    )
    AND (
      added_by = auth.uid()
      OR tagged_user_id IS NULL
      OR tagged_user_id = auth.uid()
    )
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.event_concours ec
    WHERE ec.event_id = event_concours_vehicles.event_id AND ec.enabled = true
  )
);

CREATE OR REPLACE FUNCTION public.concours_vehicles_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.event_id IS DISTINCT FROM OLD.event_id
     OR NEW.photo_url IS DISTINCT FROM OLD.photo_url
     OR NEW.sort_order IS DISTINCT FROM OLD.sort_order
     OR NEW.added_by IS DISTINCT FROM OLD.added_by THEN
    RAISE EXCEPTION 'Only club admins can change concours entry details';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_concours_vehicles_guard ON public.event_concours_vehicles;
CREATE TRIGGER event_concours_vehicles_guard
BEFORE UPDATE ON public.event_concours_vehicles
FOR EACH ROW EXECUTE FUNCTION public.concours_vehicles_guard();