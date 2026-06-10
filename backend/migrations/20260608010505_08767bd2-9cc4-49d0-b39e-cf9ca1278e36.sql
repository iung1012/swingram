
-- Revoke EXECUTE on SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- Storage policies
-- avatars: any authenticated user can SELECT (read); only owner can write to path owner_id/...
CREATE POLICY "avatars read auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');
CREATE POLICY "avatars write owner" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatars update owner" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatars delete owner" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- posts media
CREATE POLICY "posts read auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'posts');
CREATE POLICY "posts write owner" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "posts delete owner or staff" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'posts' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_staff(auth.uid())));

-- verification: only owner can upload; only admin can read
CREATE POLICY "ver write owner" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'verification' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "ver read admin or owner" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'verification' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "ver delete admin" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'verification' AND public.has_role(auth.uid(),'admin'));

-- chat_media (private)
CREATE POLICY "chat write owner" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat_media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "chat read auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat_media');
CREATE POLICY "chat delete owner or staff" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat_media' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_staff(auth.uid())));

-- Allow the has_role/is_staff functions to be used inside RLS policies (they run as definer themselves)
-- RLS expressions execute as the definer of the policy function (table owner), so revocation is fine.
