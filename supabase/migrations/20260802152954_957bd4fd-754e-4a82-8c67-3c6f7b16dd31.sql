DROP POLICY IF EXISTS "Tagger, tagged member or admin can untag" ON public.gallery_tags;
CREATE POLICY "Any signed-in member can untag"
  ON public.gallery_tags FOR DELETE TO authenticated
  USING (true);