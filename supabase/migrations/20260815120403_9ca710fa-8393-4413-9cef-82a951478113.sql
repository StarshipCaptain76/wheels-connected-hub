REVOKE EXECUTE ON FUNCTION public.notify_event_photos(uuid, uuid) FROM anon;

DROP POLICY IF EXISTS "Members can tag concours vehicles" ON public.event_concours_vehicles;
CREATE POLICY "Members can tag concours vehicles"
ON public.event_concours_vehicles
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    EXISTS (SELECT 1 FROM public.event_concours ec WHERE ec.event_id = event_concours_vehicles.event_id AND ec.enabled = true)
    AND (added_by = auth.uid() OR tagged_user_id IS NULL OR tagged_user_id = auth.uid())
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    EXISTS (SELECT 1 FROM public.event_concours ec WHERE ec.event_id = event_concours_vehicles.event_id AND ec.enabled = true)
    AND (added_by = auth.uid() OR tagged_user_id = auth.uid())
  )
);