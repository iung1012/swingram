
-- Banners: restrict select to authenticated
DROP POLICY IF EXISTS "banner select" ON public.banners;
CREATE POLICY "banner select" ON public.banners FOR SELECT TO authenticated USING (true);

-- Comments: restrict to authenticated
DROP POLICY IF EXISTS "comments select" ON public.comments;
CREATE POLICY "comments select" ON public.comments FOR SELECT TO authenticated
  USING ((status = 'visible'::text) OR (auth.uid() = user_id) OR is_staff(auth.uid()));

-- Likes: restrict to authenticated
DROP POLICY IF EXISTS "likes select" ON public.likes;
CREATE POLICY "likes select" ON public.likes FOR SELECT TO authenticated USING (true);

-- Content hashes: only staff can read the moderation blocklist
DROP POLICY IF EXISTS "hash read" ON public.content_hashes;
CREATE POLICY "hash read" ON public.content_hashes FOR SELECT TO authenticated
  USING (is_staff(auth.uid()));

-- Follows: hide rows where the followee is banned/invisible (unless self or staff)
DROP POLICY IF EXISTS "follows select authenticated" ON public.follows;
CREATE POLICY "follows select authenticated" ON public.follows FOR SELECT TO authenticated
  USING (
    auth.uid() = follower_id
    OR auth.uid() = followee_id
    OR is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = follows.followee_id
        AND COALESCE(p.banned, false) = false
        AND COALESCE(p.invisible_mode, false) = false
    )
  );

-- Stories: exclude banned/invisible owners for non-self/non-staff viewers
DROP POLICY IF EXISTS "stories select" ON public.stories;
CREATE POLICY "stories select" ON public.stories FOR SELECT TO authenticated
  USING (
    (expires_at > now())
    AND (
      auth.uid() = user_id
      OR is_staff(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = stories.user_id
          AND COALESCE(p.banned, false) = false
          AND COALESCE(p.invisible_mode, false) = false
      )
    )
  );

-- Storage: stories — drop OR true, mirror table policy
DROP POLICY IF EXISTS "stories own read" ON storage.objects;
CREATE POLICY "stories own read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'stories'
    AND (
      (auth.uid())::text = (storage.foldername(name))[1]
      OR is_staff(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.stories s
        JOIN public.profiles p ON p.user_id = s.user_id
        WHERE s.media_url LIKE '%' || name
          AND s.expires_at > now()
          AND COALESCE(p.banned, false) = false
          AND COALESCE(p.invisible_mode, false) = false
      )
    )
  );

-- Storage: posts — restrict to approved, non-deleted posts (or owner/staff)
DROP POLICY IF EXISTS "posts read auth" ON storage.objects;
CREATE POLICY "posts read auth" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'posts'
    AND (
      (auth.uid())::text = (storage.foldername(name))[1]
      OR is_staff(auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.post_media pm
        JOIN public.posts po ON po.id = pm.post_id
        WHERE pm.url LIKE '%' || name
          AND po.moderation_status = 'approved'
          AND po.deleted_at IS NULL
      )
    )
  );

-- Lock down handle_new_user (trigger-only)
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
