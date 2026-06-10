
CREATE POLICY "banner read auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'banners');
CREATE POLICY "banner write admin" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'banners' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "banner delete admin" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'banners' AND public.has_role(auth.uid(), 'admin'));
