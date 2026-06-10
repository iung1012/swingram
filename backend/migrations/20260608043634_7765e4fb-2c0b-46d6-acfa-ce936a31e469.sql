
ALTER TABLE public.posts ALTER COLUMN moderation_status SET DEFAULT 'approved'::moderation_status;
UPDATE public.posts SET moderation_status = 'approved' WHERE moderation_status = 'pending';

CREATE TABLE IF NOT EXISTS public.follows (
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);

GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "follows select authenticated" ON public.follows
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "follows insert self" ON public.follows
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows delete self" ON public.follows
  FOR DELETE TO authenticated USING (auth.uid() = follower_id);

CREATE INDEX IF NOT EXISTS follows_followee_idx ON public.follows(followee_id);
