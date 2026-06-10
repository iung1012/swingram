-- =========================================================
-- STORIES: quem viu, reações e respostas
-- =========================================================

-- 1) STORY_VIEWS — registra cada visualização (1 por viewer/story)
CREATE TABLE IF NOT EXISTS public.story_views (
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, viewer_id)
);
CREATE INDEX IF NOT EXISTS story_views_story_idx ON public.story_views(story_id);

-- 2) STORY_REACTIONS — uma reação (emoji) por viewer/story
CREATE TABLE IF NOT EXISTS public.story_reactions (
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, user_id)
);
CREATE INDEX IF NOT EXISTS story_reactions_story_idx ON public.story_reactions(story_id);

-- 3) STORY_REPLIES — respostas em texto, lidas pelo autor do story
CREATE TABLE IF NOT EXISTS public.story_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(btrim(body)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS story_replies_story_idx ON public.story_replies(story_id, created_at);

-- GRANTS
GRANT SELECT, INSERT, DELETE ON public.story_views TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_reactions TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.story_replies TO authenticated;

-- RLS
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_replies ENABLE ROW LEVEL SECURITY;

-- Helper: o story pertence ao usuário corrente?
-- (inline via EXISTS nas policies abaixo)

-- story_views: o viewer registra a própria view; o autor do story (ou staff)
-- e o próprio viewer podem ler.
CREATE POLICY "story_views insert self" ON public.story_views FOR INSERT
  WITH CHECK (auth.uid() = viewer_id);
CREATE POLICY "story_views read" ON public.story_views FOR SELECT
  USING (
    auth.uid() = viewer_id
    OR public.is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.user_id = auth.uid())
  );

-- story_reactions: o autor da reação gerencia a própria; autor do story/staff leem.
CREATE POLICY "story_reactions self" ON public.story_reactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "story_reactions owner read" ON public.story_reactions FOR SELECT
  USING (
    public.is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.user_id = auth.uid())
  );

-- story_replies: remetente cria/apaga a própria; autor do story/staff leem.
CREATE POLICY "story_replies insert sender" ON public.story_replies FOR INSERT
  WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "story_replies read" ON public.story_replies FOR SELECT
  USING (
    auth.uid() = sender_id
    OR public.is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.user_id = auth.uid())
  );
CREATE POLICY "story_replies delete" ON public.story_replies FOR DELETE
  USING (
    auth.uid() = sender_id
    OR public.is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.user_id = auth.uid())
  );
