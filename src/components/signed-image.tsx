import { useEffect, useState } from "react";
import { api } from "@/integrations/api/client";

/**
 * SignedImage works for both public-style avatars and private bucket files.
 * Pass either a full URL (starts with http) or a "bucket/path" reference.
 * Signed URLs are cached in-memory and deduped so the same path is signed once
 * per session (until the cached URL is about to expire).
 */
type CacheEntry = { url: string; expiresAt: number };
const urlCache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<string | null>>();
const TTL_SECONDS = 3600;
// Refresh slightly before the real expiry so we never hand out stale URLs.
const REFRESH_BEFORE_MS = 60_000;

function cacheKey(bucket: string, path: string) {
  return `${bucket}/${path}`;
}

async function getSignedUrl(bucket: string, path: string): Promise<string | null> {
  const key = cacheKey(bucket, path);
  const hit = urlCache.get(key);
  if (hit && hit.url.startsWith("http") && hit.expiresAt - Date.now() > REFRESH_BEFORE_MS) return hit.url;
  if (hit && !hit.url.startsWith("http")) urlCache.delete(key);
  const inflight = pending.get(key);
  if (inflight) return inflight;
  const p = api.storage
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
  const isHttp = !!src && src.startsWith("http");
  const isPathHttp = !!path && path.startsWith("http");
  const initial = isHttp ? src! : isPathHttp ? path! : null;
  const [url, setUrl] = useState<string | null>(initial);

  useEffect(() => {
    let cancelled = false;
    if (isHttp) { setUrl(src!); return; }
    if (isPathHttp) { setUrl(path!); return; }
    const b = bucket;
    const p = path ?? src;
    if (!b || !p) { setUrl(null); return; }
    // Synchronous cache hit avoids a render flash.
    const hit = urlCache.get(cacheKey(b, p));
    if (hit && hit.expiresAt - Date.now() > REFRESH_BEFORE_MS) {
      setUrl(hit.url);
      return;
    }
    getSignedUrl(b, p).then((u) => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
  }, [src, bucket, path, isHttp, isPathHttp]);

  if (!url) {
    return <div className={`bg-muted ${className ?? ""}`} aria-label={alt} />;
  }
  return <img src={url} alt={alt} className={className} loading="lazy" decoding="async" />;
}

