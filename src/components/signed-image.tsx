import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * SignedImage works for both public-style avatars and private bucket files.
 * Pass either a full URL (starts with http) or a "bucket/path" reference.
 */
export function SignedImage({
  src,
  bucket,
  path,
  alt,
  className,
}: {
  src?: string | null;
  bucket?: string;
  path?: string | null;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(src && src.startsWith("http") ? src : null);

  useEffect(() => {
    let cancelled = false;
    if (src && src.startsWith("http")) {
      setUrl(src);
      return;
    }
    const b = bucket;
    const p = path ?? src;
    if (!b || !p) return;
    supabase.storage
      .from(b)
      .createSignedUrl(p, 3600)
      .then(({ data }) => {
        if (!cancelled && data) setUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [src, bucket, path]);

  if (!url) {
    return <div className={`bg-muted ${className ?? ""}`} aria-label={alt} />;
  }
  return <img src={url} alt={alt} className={className} loading="lazy" />;
}
