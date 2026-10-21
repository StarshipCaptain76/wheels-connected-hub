ALTER TABLE public.event_concours
  ADD COLUMN IF NOT EXISTS tiebreak_vehicle_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tiebreak_winner_vehicle_id uuid,
  ADD COLUMN IF NOT EXISTS tiebreak_drawn_at timestamptz,
  ADD COLUMN IF NOT EXISTS tiebreak_drawn_by uuid,
  ADD COLUMN IF NOT EXISTS tiebreak_score numeric;