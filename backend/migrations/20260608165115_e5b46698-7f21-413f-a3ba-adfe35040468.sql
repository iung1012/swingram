CREATE OR REPLACE FUNCTION public.check_rate_limit(p_action text, p_max integer, p_window_seconds integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  bucket timestamptz;
  current_count integer;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  -- Bypass rate limiting for admin/staff users
  IF public.is_staff(uid) THEN
    RETURN;
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
$function$;