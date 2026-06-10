
-- 1) PROFILES
DROP POLICY IF EXISTS "profiles select all" ON public.profiles;
CREATE POLICY "profiles select scoped"
ON public.profiles FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_staff(auth.uid())
  OR (COALESCE(banned, false) = false AND COALESCE(invisible_mode, false) = false)
);
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.profiles FROM anon;

-- 2) AVATARS
DROP POLICY IF EXISTS "avatars read auth" ON storage.objects;
CREATE POLICY "avatars read scoped"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id::text = (storage.foldername(name))[1]
        AND COALESCE(p.banned, false) = false
        AND COALESCE(p.invisible_mode, false) = false
    )
  )
);

-- 3) CHAT_MEDIA
DROP POLICY IF EXISTS "chat read auth" ON storage.objects;
CREATE POLICY "chat read participants"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat_media'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.unlocked = true
        AND (
          (c.user_a = auth.uid() AND c.user_b::text = (storage.foldername(name))[1])
          OR (c.user_b = auth.uid() AND c.user_a::text = (storage.foldername(name))[1])
        )
    )
  )
);

-- 4) BANNERS
DROP POLICY IF EXISTS "banner update admin" ON storage.objects;
CREATE POLICY "banner update admin"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'banners' AND public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'banners' AND public.has_role(auth.uid(), 'admin'::app_role));

-- 5) VERIFICATION
DROP POLICY IF EXISTS "ver update admin" ON storage.objects;
CREATE POLICY "ver update admin"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'verification' AND public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'verification' AND public.has_role(auth.uid(), 'admin'::app_role));
