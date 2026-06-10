
CREATE TABLE IF NOT EXISTS public.rate_limits (
  user_id uuid NOT NULL,
  action text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, action, window_start)
);

GRANT ALL ON public.rate_limits TO service_role;

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rate_limits_no_access" ON public.rate_limits
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS rate_limits_cleanup_idx ON public.rate_limits (window_start);

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_action text,
  p_max integer,
  p_window_seconds integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  bucket timestamptz;
  current_count integer;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  bucket := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  INSERT INTO public.rate_limits (user_id, action, window_start, count)
  VALUES (uid, p_action, bucket, 1)
  ON CONFLICT (user_id, action, window_start)
  DO UPDATE SET count = public.rate_limits.count + 1
  RETURNING count INTO current_count;

  IF current_count > p_max THEN
    RAISE EXCEPTION 'rate_limit_exceeded:%:%', p_action, p_window_seconds
      USING ERRCODE = 'P0001';
  END IF;

  -- best-effort cleanup of old buckets (>24h)
  DELETE FROM public.rate_limits
   WHERE user_id = uid
     AND window_start < now() - interval '24 hours';
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO authenticated;
