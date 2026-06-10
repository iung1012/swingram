-- CHAT MEDIA
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS media_path TEXT,
  ADD COLUMN IF NOT EXISTS media_kind TEXT;

ALTER TABLE public.messages ALTER COLUMN body DROP NOT NULL;

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_content_present;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_content_present
  CHECK (
    (body IS NOT NULL AND length(btrim(body)) > 0)
    OR media_path IS NOT NULL
  );

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_media_kind_chk;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_media_kind_chk
  CHECK (media_kind IS NULL OR media_kind IN ('image', 'video'));

DROP POLICY IF EXISTS "msg delete staff" ON public.messages;
DROP POLICY IF EXISTS "msg delete own or staff" ON public.messages;
CREATE POLICY "msg delete own or staff" ON public.messages FOR DELETE
  USING (auth.uid() = sender_id OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "conv delete participant" ON public.conversations;
CREATE POLICY "conv delete participant" ON public.conversations FOR DELETE
  USING (auth.uid() IN (user_a, user_b) OR public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.mark_messages_read(p_conversation_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = p_conversation_id
      AND auth.uid() IN (c.user_a, c.user_b)
  ) THEN
    RAISE EXCEPTION 'not a participant';
  END IF;

  UPDATE public.messages
  SET read_at = now()
  WHERE conversation_id = p_conversation_id
    AND sender_id <> auth.uid()
    AND read_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_messages_read(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_messages_read(UUID) TO authenticated;

-- STORIES ENGAGEMENT
CREATE TABLE IF NOT EXISTS public.story_views (
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, viewer_id)
);
CREATE INDEX IF NOT EXISTS story_views_story_idx ON public.story_views(story_id);

CREATE TABLE IF NOT EXISTS public.story_reactions (
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, user_id)
);
CREATE INDEX IF NOT EXISTS story_reactions_story_idx ON public.story_reactions(story_id);

CREATE TABLE IF NOT EXISTS public.story_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(btrim(body)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS story_replies_story_idx ON public.story_replies(story_id, created_at);

GRANT SELECT, INSERT, DELETE ON public.story_views TO authenticated;
GRANT ALL ON public.story_views TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_reactions TO authenticated;
GRANT ALL ON public.story_reactions TO service_role;
GRANT SELECT, INSERT, DELETE ON public.story_replies TO authenticated;
GRANT ALL ON public.story_replies TO service_role;

ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "story_views insert self" ON public.story_views FOR INSERT
  WITH CHECK (auth.uid() = viewer_id);
CREATE POLICY "story_views read" ON public.story_views FOR SELECT
  USING (
    auth.uid() = viewer_id
    OR public.is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.user_id = auth.uid())
  );

CREATE POLICY "story_reactions self" ON public.story_reactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "story_reactions owner read" ON public.story_reactions FOR SELECT
  USING (
    public.is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.user_id = auth.uid())
  );

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