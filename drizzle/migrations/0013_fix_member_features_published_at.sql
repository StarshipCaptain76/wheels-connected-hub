ALTER TABLE public.member_features ADD COLUMN IF NOT EXISTS published_at timestamptz;
UPDATE public.member_features SET published_at = publishead_at WHERE published_at IS NULL AND publishead_at IS NOT NULL;
COMMENT ON COLUMN public.member_features.publishead_at IS 'DEPRECATED: replaced by published_at (typo column, do not use)';