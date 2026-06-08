
-- Allow text-only posts and videos
ALTER TABLE public.post_media
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'image'
    CHECK (kind IN ('image','video'));

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS hashtags text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS posts_hashtags_gin ON public.posts USING GIN (hashtags);

-- Function to extract hashtags from caption and auto-update column
CREATE OR REPLACE FUNCTION public.posts_extract_hashtags()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  tags text[];
BEGIN
  IF NEW.caption IS NULL OR NEW.caption = '' THEN
    NEW.hashtags := '{}';
  ELSE
    SELECT COALESCE(array_agg(DISTINCT lower(m[1])), '{}')
      INTO tags
      FROM regexp_matches(NEW.caption, '#([A-Za-z0-9_\u00C0-\u017F]{1,50})', 'g') AS m;
    NEW.hashtags := tags;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_posts_extract_hashtags ON public.posts;
CREATE TRIGGER trg_posts_extract_hashtags
  BEFORE INSERT OR UPDATE OF caption ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.posts_extract_hashtags();

-- Backfill existing rows
UPDATE public.posts SET caption = caption WHERE caption IS NOT NULL;
