
-- Policies for avatars and posts buckets: user-scoped folder (first path segment = user id)
DO $$
DECLARE b text;
BEGIN
  FOREACH b IN ARRAY ARRAY['avatars','posts'] LOOP
    EXECUTE format($f$
      CREATE POLICY "%1$s_select_own" ON storage.objects FOR SELECT TO authenticated
        USING (bucket_id = %2$L AND auth.uid()::text = (storage.foldername(name))[1]);
      CREATE POLICY "%1$s_insert_own" ON storage.objects FOR INSERT TO authenticated
        WITH CHECK (bucket_id = %2$L AND auth.uid()::text = (storage.foldername(name))[1]);
      CREATE POLICY "%1$s_update_own" ON storage.objects FOR UPDATE TO authenticated
        USING (bucket_id = %2$L AND auth.uid()::text = (storage.foldername(name))[1]);
      CREATE POLICY "%1$s_delete_own" ON storage.objects FOR DELETE TO authenticated
        USING (bucket_id = %2$L AND auth.uid()::text = (storage.foldername(name))[1]);
    $f$, b, b);
  END LOOP;
END $$;
