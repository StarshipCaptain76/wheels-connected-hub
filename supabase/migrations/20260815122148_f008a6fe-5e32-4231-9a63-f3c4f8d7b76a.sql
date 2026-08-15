ALTER TABLE public.event_concours
  ADD COLUMN IF NOT EXISTS winner_blurb_en text,
  ADD COLUMN IF NOT EXISTS winner_blurb_af text;