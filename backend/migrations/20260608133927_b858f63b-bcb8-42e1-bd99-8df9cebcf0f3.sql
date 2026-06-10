CREATE TABLE public.profile_views (
  profile_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, viewer_id, day)
);
CREATE INDEX profile_views_profile_idx ON public.profile_views(profile_id);
GRANT SELECT, INSERT ON public.profile_views TO authenticated;
GRANT ALL ON public.profile_views TO service_role;
ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profile_views select" ON public.profile_views FOR SELECT TO authenticated USING (true);
CREATE POLICY "profile_views insert self" ON public.profile_views FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = viewer_id AND auth.uid() <> profile_id);