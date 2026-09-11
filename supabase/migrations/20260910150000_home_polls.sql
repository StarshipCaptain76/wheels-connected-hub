-- Homepage club polls. Idempotent. Counts are exposed via SECURITY DEFINER
-- so the home page never needs to read individual vote rows (no fingerprints).

CREATE TABLE IF NOT EXISTS public.polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_en text NOT NULL DEFAULT '',
  title_af text,
  question_en text NOT NULL DEFAULT '',
  question_af text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'open', 'closed')),
  show_on_home boolean NOT NULL DEFAULT false,
  allow_member_options boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  label_en text NOT NULL,
  label_af text,
  source text NOT NULL DEFAULT 'admin'
    CHECK (source IN ('admin', 'member')),
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  hidden boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS poll_options_label_uniq
  ON public.poll_options (poll_id, lower(btrim(label_en)));

CREATE UNIQUE INDEX IF NOT EXISTS poll_options_one_member
  ON public.poll_options (poll_id, added_by)
  WHERE source = 'member' AND added_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS polls_home_idx
  ON public.polls (sort_order)
  WHERE status = 'open' AND show_on_home;

CREATE INDEX IF NOT EXISTS poll_options_poll_id_idx
  ON public.poll_options (poll_id, sort_order);

CREATE INDEX IF NOT EXISTS poll_votes_option_id_idx
  ON public.poll_votes (option_id);

ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- Polls -----------------------------------------------------------------
DROP POLICY IF EXISTS "Public read open or closed polls" ON public.polls;
CREATE POLICY "Public read open or closed polls"
ON public.polls FOR SELECT TO anon, authenticated
USING (status IN ('open', 'closed'));

DROP POLICY IF EXISTS "Admins read all polls" ON public.polls;
CREATE POLICY "Admins read all polls"
ON public.polls FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage polls" ON public.polls;
CREATE POLICY "Admins manage polls"
ON public.polls FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Options ---------------------------------------------------------------
DROP POLICY IF EXISTS "Public read visible options of public polls" ON public.poll_options;
CREATE POLICY "Public read visible options of public polls"
ON public.poll_options FOR SELECT TO anon, authenticated
USING (
  hidden = false
  AND EXISTS (
    SELECT 1 FROM public.polls p
    WHERE p.id = poll_options.poll_id
      AND p.status IN ('open', 'closed')
  )
);

DROP POLICY IF EXISTS "Admins read all poll options" ON public.poll_options;
CREATE POLICY "Admins read all poll options"
ON public.poll_options FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Members add option to open poll" ON public.poll_options;
CREATE POLICY "Members add option to open poll"
ON public.poll_options FOR INSERT TO authenticated
WITH CHECK (
  source = 'member'
  AND added_by = auth.uid()
  AND hidden = false
  AND EXISTS (
    SELECT 1 FROM public.polls p
    WHERE p.id = poll_options.poll_id
      AND p.status = 'open'
      AND p.allow_member_options = true
  )
);

DROP POLICY IF EXISTS "Admins manage poll options" ON public.poll_options;
CREATE POLICY "Admins manage poll options"
ON public.poll_options FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Votes -----------------------------------------------------------------
DROP POLICY IF EXISTS "Members read own poll votes" ON public.poll_votes;
CREATE POLICY "Members read own poll votes"
ON public.poll_votes FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins read all poll votes" ON public.poll_votes;
CREATE POLICY "Admins read all poll votes"
ON public.poll_votes FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Members insert own poll vote" ON public.poll_votes;
CREATE POLICY "Members insert own poll vote"
ON public.poll_votes FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.polls p
    WHERE p.id = poll_votes.poll_id AND p.status = 'open'
  )
  AND EXISTS (
    SELECT 1 FROM public.poll_options o
    WHERE o.id = poll_votes.option_id
      AND o.poll_id = poll_votes.poll_id
      AND o.hidden = false
  )
);

DROP POLICY IF EXISTS "Members update own poll vote" ON public.poll_votes;
CREATE POLICY "Members update own poll vote"
ON public.poll_votes FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.polls p
    WHERE p.id = poll_votes.poll_id AND p.status = 'open'
  )
  AND EXISTS (
    SELECT 1 FROM public.poll_options o
    WHERE o.id = poll_votes.option_id
      AND o.poll_id = poll_votes.poll_id
      AND o.hidden = false
  )
);

DROP POLICY IF EXISTS "Admins manage poll votes" ON public.poll_votes;
CREATE POLICY "Admins manage poll votes"
ON public.poll_votes FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

GRANT SELECT ON public.polls TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.polls TO authenticated;

GRANT SELECT ON public.poll_options TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.poll_options TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.poll_votes TO authenticated;

CREATE OR REPLACE FUNCTION public.poll_option_vote_counts(_poll_ids uuid[])
RETURNS TABLE (option_id uuid, vote_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.option_id, count(*)::bigint
  FROM public.poll_votes v
  WHERE v.poll_id = ANY (_poll_ids)
  GROUP BY v.option_id;
$$;

REVOKE ALL ON FUNCTION public.poll_option_vote_counts(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.poll_option_vote_counts(uuid[]) TO anon, authenticated;

-- Seed the two launch polls (open + on home, no votes).
INSERT INTO public.polls (
  id, title_en, title_af, question_en, question_af,
  status, show_on_home, allow_member_options, sort_order
) VALUES
  (
    'c1ab0001-0000-4000-8000-000000000001',
    'Next outing',
    'Volgende uitstappie',
    'Where do you want to go next?',
    'Waarheen wil julle volgende toe gaan?',
    'open', true, true, 10
  ),
  (
    'c1ab0001-0000-4000-8000-000000000002',
    'Driving distance',
    'Ritafstand',
    'How far are you willing to drive?',
    'Hoe ver is jy bereid om te ry?',
    'open', true, true, 20
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.poll_options (
  id, poll_id, label_en, label_af, source, hidden, sort_order
) VALUES
  ('c1ab0001-0000-4000-8000-000000000011', 'c1ab0001-0000-4000-8000-000000000001', 'Stilbaai', 'Stilbaai', 'admin', false, 10),
  ('c1ab0001-0000-4000-8000-000000000012', 'c1ab0001-0000-4000-8000-000000000001', 'Riversdale', 'Riversdale', 'admin', false, 20),
  ('c1ab0001-0000-4000-8000-000000000013', 'c1ab0001-0000-4000-8000-000000000001', 'Mossel Bay', 'Mosselbaai', 'admin', false, 30),
  ('c1ab0001-0000-4000-8000-000000000014', 'c1ab0001-0000-4000-8000-000000000001', 'Swellendam', 'Swellendam', 'admin', false, 40),
  ('c1ab0001-0000-4000-8000-000000000015', 'c1ab0001-0000-4000-8000-000000000001', 'Garden Route pass run', 'Tuinroete-pasrit', 'admin', false, 50),
  ('c1ab0001-0000-4000-8000-000000000016', 'c1ab0001-0000-4000-8000-000000000001', 'Overnight weekend away', 'Oornag-naweek weg', 'admin', false, 60),
  ('c1ab0001-0000-4000-8000-000000000017', 'c1ab0001-0000-4000-8000-000000000001', 'Bring-and-braai at a farm', 'Bring-en-braai op ''n plaas', 'admin', false, 70),
  ('c1ab0001-0000-4000-8000-000000000021', 'c1ab0001-0000-4000-8000-000000000002', 'Under 50 km', 'Onder 50 km', 'admin', false, 10),
  ('c1ab0001-0000-4000-8000-000000000022', 'c1ab0001-0000-4000-8000-000000000002', '50–100 km', '50–100 km', 'admin', false, 20),
  ('c1ab0001-0000-4000-8000-000000000023', 'c1ab0001-0000-4000-8000-000000000002', '100–200 km', '100–200 km', 'admin', false, 30),
  ('c1ab0001-0000-4000-8000-000000000024', 'c1ab0001-0000-4000-8000-000000000002', '200–400 km', '200–400 km', 'admin', false, 40),
  ('c1ab0001-0000-4000-8000-000000000025', 'c1ab0001-0000-4000-8000-000000000002', 'Overnight / any distance', 'Oornag / enige afstand', 'admin', false, 50)
ON CONFLICT (id) DO NOTHING;
