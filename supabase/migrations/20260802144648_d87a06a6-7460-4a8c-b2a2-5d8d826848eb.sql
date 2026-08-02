CREATE TABLE public.gallery_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_item_id uuid NOT NULL REFERENCES public.gallery_items(id) ON DELETE CASCADE,
  tagged_user_id uuid NOT NULL,
  tagged_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gallery_item_id, tagged_user_id)
);
CREATE INDEX gallery_tags_user_idx ON public.gallery_tags(tagged_user_id);
CREATE INDEX gallery_tags_item_idx ON public.gallery_tags(gallery_item_id);

GRANT SELECT, INSERT, DELETE ON public.gallery_tags TO authenticated;
GRANT SELECT ON public.gallery_tags TO anon;
GRANT ALL ON public.gallery_tags TO service_role;

ALTER TABLE public.gallery_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tags on published photos are readable"
  ON public.gallery_tags FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.gallery_items g WHERE g.id = gallery_item_id AND g.is_published));

CREATE POLICY "Members can tag"
  ON public.gallery_tags FOR INSERT TO authenticated
  WITH CHECK (tagged_by = auth.uid());

CREATE POLICY "Tagger, tagged member or admin can untag"
  ON public.gallery_tags FOR DELETE TO authenticated
  USING (tagged_by = auth.uid() OR tagged_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.gallery_tag_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_item_id uuid REFERENCES public.gallery_items(id) ON DELETE SET NULL,
  email text NOT NULL,
  note text,
  invited_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX gallery_tag_invites_by_idx ON public.gallery_tag_invites(invited_by, created_at DESC);

GRANT SELECT, INSERT ON public.gallery_tag_invites TO authenticated;
GRANT ALL ON public.gallery_tag_invites TO service_role;

ALTER TABLE public.gallery_tag_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Inviter or admin can view invites"
  ON public.gallery_tag_invites FOR SELECT TO authenticated
  USING (invited_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members can create their own invites"
  ON public.gallery_tag_invites FOR INSERT TO authenticated
  WITH CHECK (invited_by = auth.uid());

ALTER TABLE public.notification_prefs ADD COLUMN IF NOT EXISTS photo_tag boolean NOT NULL DEFAULT true;