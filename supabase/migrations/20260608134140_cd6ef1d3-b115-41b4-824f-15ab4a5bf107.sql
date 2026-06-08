DROP POLICY IF EXISTS "likes select" ON public.likes;
CREATE POLICY "likes select all" ON public.likes FOR SELECT USING (true);