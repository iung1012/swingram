import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type CacheEntry = { url: string; expiresAt: number };
const urlCache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<string | null>>();
const TTL_SECONDS = 3600;
const REFRESH_BEFORE_MS = 60_000;

function cacheKey(bucket: string, path: string) {
  return `${bucket}/${path}`;
}

async function getSignedUrl(bucket: string, path: string): Promise<string | null> {
  const key = cacheKey(bucket, path);
  const hit = urlCache.get(key);
  if (hit && hit.expiresAt - Date.now() > REFRESH_BEFORE_MS) return hit.url;
  const inflight = pending.get(key);
  if (inflight) return inflight;
  const p = supabase.storage
    .from(bucket)
    .createSignedUrl(path, TTL_SECONDS)
    .then(({ data }) => {
      const url = data?.signedUrl ?? null;
      if (url) urlCache.set(key, { url, expiresAt: Date.now() + TTL_SECONDS * 1000 });
      return url;
    })
    .finally(() => { pending.delete(key); });
  pending.set(key, p);
  return p;
}

/** Renders an image OR a video from a signed Cloud storage path. */
export function SignedMedia({
  bucket,
  path,
  kind,
  alt,
  className,
  controls = true,
  autoPlay,
  muted = true,
  loop,
  playsInline = true,
}: {
  bucket: string;
  path?: string | null;
  kind: "image" | "video";
  alt: string;
  className?: string;
  controls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  playsInline?: boolean;
}) {
  const isHttp = !!path && path.startsWith("http");
  const [url, setUrl] = useState<string | null>(isHttp ? path! : null);

  useEffect(() => {
    let cancelled = false;
    if (isHttp) { setUrl(path!); return; }
    if (!bucket || !path) { setUrl(null); return; }
    const hit = urlCache.get(cacheKey(bucket, path));
    if (hit && hit.expiresAt - Date.now() > REFRESH_BEFORE_MS) { setUrl(hit.url); return; }
    getSignedUrl(bucket, path).then((u) => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
  }, [bucket, path, isHttp]);

  if (!url) return <div className={`bg-muted ${className ?? ""}`} aria-label={alt} />;
  if (kind === "video") {
    return (
      <video
        src={url}
        className={className}
        controls={controls}
        autoPlay={autoPlay}
        muted={muted}
        loop={loop}
        playsInline={playsInline}
        preload="metadata"
      />
    );
  }
  return <img src={url} alt={alt} className={className} loading="lazy" decoding="async" />;
}
