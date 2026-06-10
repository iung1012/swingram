DO $$
BEGIN
  CREATE TYPE public.profile_visibility AS ENUM ('public', 'followers', 'hidden');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_visibility public.profile_visibility NOT NULL DEFAULT 'public';

UPDATE public.profiles
SET profile_visibility = 'hidden'
WHERE COALESCE(invisible_mode, false) = true
  AND COALESCE(profile_visibility, 'public'::public.profile_visibility) <> 'hidden'::public.profile_visibility;

-- Profiles: hide restricted accounts unless self/staff or follower when allowed
DROP POLICY IF EXISTS "profiles select all" ON public.profiles;
DROP POLICY IF EXISTS "profiles select scoped" ON public.profiles;
CREATE POLICY "profiles select scoped" ON public.profiles FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_staff(auth.uid())
    OR (
      COALESCE(banned, false) = false
      AND COALESCE(invisible_mode, false) = false
      AND NOT EXISTS (
        SELECT 1
        FROM public.blocks b
        WHERE (
          (b.user_id = auth.uid() AND b.blocked_user_id = profiles.user_id)
          OR (b.user_id = profiles.user_id AND b.blocked_user_id = auth.uid())
        )
      )
      AND (
        COALESCE(profile_visibility, 'public'::public.profile_visibility) = 'public'::public.profile_visibility
        OR (
          COALESCE(profile_visibility, 'public'::public.profile_visibility) = 'followers'::public.profile_visibility
          AND EXISTS (
            SELECT 1
            FROM public.follows f
            WHERE f.follower_id = auth.uid()
              AND f.followee_id = profiles.user_id
          )
        )
      )
    )
  );

-- Blocks: let both sides inspect the relation so privacy-aware filters work client-side
DROP POLICY IF EXISTS "blocks self" ON public.blocks;
CREATE POLICY "blocks select self or blocked" ON public.blocks FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = blocked_user_id OR public.is_staff(auth.uid()));
CREATE POLICY "blocks insert self" ON public.blocks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "blocks delete self" ON public.blocks FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Posts: only surface approved content from profiles that are actually visible
DROP POLICY IF EXISTS "posts select" ON public.posts;
CREATE POLICY "posts select" ON public.posts FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      moderation_status = 'approved'::public.moderation_status
      OR auth.uid() = user_id
      OR public.is_staff(auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.user_id = posts.user_id
          AND COALESCE(p.banned, false) = false
          AND COALESCE(p.invisible_mode, false) = false
          AND NOT EXISTS (
            SELECT 1
            FROM public.blocks b
            WHERE (
              (b.user_id = auth.uid() AND b.blocked_user_id = p.user_id)
              OR (b.user_id = p.user_id AND b.blocked_user_id = auth.uid())
            )
          )
          AND (
            COALESCE(p.profile_visibility, 'public'::public.profile_visibility) = 'public'::public.profile_visibility
            OR (
              COALESCE(p.profile_visibility, 'public'::public.profile_visibility) = 'followers'::public.profile_visibility
              AND EXISTS (
                SELECT 1
                FROM public.follows f
                WHERE f.follower_id = auth.uid()
                  AND f.followee_id = p.user_id
              )
            )
          )
      )
    )
  );

DROP POLICY IF EXISTS "media select" ON public.post_media;
CREATE POLICY "media select" ON public.post_media FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.posts p
      JOIN public.profiles prof ON prof.user_id = p.user_id
      WHERE p.id = post_id
        AND (
          (p.moderation_status = 'approved'::public.moderation_status AND p.deleted_at IS NULL)
          OR auth.uid() = p.user_id
          OR public.is_staff(auth.uid())
          OR (
            COALESCE(prof.banned, false) = false
            AND COALESCE(prof.invisible_mode, false) = false
            AND NOT EXISTS (
              SELECT 1
              FROM public.blocks b
              WHERE (
                (b.user_id = auth.uid() AND b.blocked_user_id = prof.user_id)
                OR (b.user_id = prof.user_id AND b.blocked_user_id = auth.uid())
              )
            )
            AND (
              COALESCE(prof.profile_visibility, 'public'::public.profile_visibility) = 'public'::public.profile_visibility
              OR (
                COALESCE(prof.profile_visibility, 'public'::public.profile_visibility) = 'followers'::public.profile_visibility
                AND EXISTS (
                  SELECT 1
                  FROM public.follows f
                  WHERE f.follower_id = auth.uid()
                    AND f.followee_id = prof.user_id
                )
              )
            )
          )
        )
    )
  );

-- Follows: keep discovery scoped to visible accounts
DROP POLICY IF EXISTS "follows select authenticated" ON public.follows;
CREATE POLICY "follows select authenticated" ON public.follows FOR SELECT TO authenticated
  USING (
    auth.uid() = follower_id
    OR auth.uid() = followee_id
    OR public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = follows.followee_id
        AND COALESCE(p.banned, false) = false
        AND COALESCE(p.invisible_mode, false) = false
        AND NOT EXISTS (
          SELECT 1
          FROM public.blocks b
          WHERE (
            (b.user_id = auth.uid() AND b.blocked_user_id = p.user_id)
            OR (b.user_id = p.user_id AND b.blocked_user_id = auth.uid())
          )
        )
        AND (
          COALESCE(p.profile_visibility, 'public'::public.profile_visibility) = 'public'::public.profile_visibility
          OR (
            COALESCE(p.profile_visibility, 'public'::public.profile_visibility) = 'followers'::public.profile_visibility
            AND EXISTS (
              SELECT 1
              FROM public.follows f
              WHERE f.follower_id = auth.uid()
                AND f.followee_id = p.user_id
            )
          )
        )
    )
  );

-- Stories: hide stories from hidden / followers-only profiles unless visible to the viewer
DROP POLICY IF EXISTS "stories select" ON public.stories;
CREATE POLICY "stories select" ON public.stories FOR SELECT TO authenticated
  USING (
    expires_at > now()
    AND (
      auth.uid() = user_id
      OR public.is_staff(auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.user_id = stories.user_id
          AND COALESCE(p.banned, false) = false
          AND COALESCE(p.invisible_mode, false) = false
          AND NOT EXISTS (
            SELECT 1
            FROM public.blocks b
            WHERE (
              (b.user_id = auth.uid() AND b.blocked_user_id = p.user_id)
              OR (b.user_id = p.user_id AND b.blocked_user_id = auth.uid())
            )
          )
          AND (
            COALESCE(p.profile_visibility, 'public'::public.profile_visibility) = 'public'::public.profile_visibility
            OR (
              COALESCE(p.profile_visibility, 'public'::public.profile_visibility) = 'followers'::public.profile_visibility
              AND EXISTS (
                SELECT 1
                FROM public.follows f
                WHERE f.follower_id = auth.uid()
                  AND f.followee_id = p.user_id
              )
            )
          )
      )
    )
  );

DROP POLICY IF EXISTS "stories own read" ON storage.objects;
CREATE POLICY "stories own read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'stories'
    AND (
      (auth.uid())::text = (storage.foldername(name))[1]
      OR public.is_staff(auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.stories s
        JOIN public.profiles p ON p.user_id = s.user_id
        WHERE s.media_url LIKE '%' || name
          AND s.expires_at > now()
          AND COALESCE(p.banned, false) = false
          AND COALESCE(p.invisible_mode, false) = false
          AND NOT EXISTS (
            SELECT 1
            FROM public.blocks b
            WHERE (
              (b.user_id = auth.uid() AND b.blocked_user_id = p.user_id)
              OR (b.user_id = p.user_id AND b.blocked_user_id = auth.uid())
            )
          )
          AND (
            COALESCE(p.profile_visibility, 'public'::public.profile_visibility) = 'public'::public.profile_visibility
            OR (
              COALESCE(p.profile_visibility, 'public'::public.profile_visibility) = 'followers'::public.profile_visibility
              AND EXISTS (
                SELECT 1
                FROM public.follows f
                WHERE f.follower_id = auth.uid()
                  AND f.followee_id = p.user_id
              )
            )
          )
      )
    )
  );

DROP POLICY IF EXISTS "posts read auth" ON storage.objects;
CREATE POLICY "posts read auth" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'posts'
    AND (
      (auth.uid())::text = (storage.foldername(name))[1]
      OR public.is_staff(auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.post_media pm
        JOIN public.posts po ON po.id = pm.post_id
        JOIN public.profiles p ON p.user_id = po.user_id
        WHERE pm.url LIKE '%' || name
          AND po.moderation_status = 'approved'
          AND po.deleted_at IS NULL
          AND COALESCE(p.banned, false) = false
          AND COALESCE(p.invisible_mode, false) = false
          AND NOT EXISTS (
            SELECT 1
            FROM public.blocks b
            WHERE (
              (b.user_id = auth.uid() AND b.blocked_user_id = p.user_id)
              OR (b.user_id = p.user_id AND b.blocked_user_id = auth.uid())
            )
          )
          AND (
            COALESCE(p.profile_visibility, 'public'::public.profile_visibility) = 'public'::public.profile_visibility
            OR (
              COALESCE(p.profile_visibility, 'public'::public.profile_visibility) = 'followers'::public.profile_visibility
              AND EXISTS (
                SELECT 1
                FROM public.follows f
                WHERE f.follower_id = auth.uid()
                  AND f.followee_id = p.user_id
              )
            )
          )
      )
    )
  );
