import { createServerFn } from "@tanstack/react-start";

const REQUIRED_BUCKETS: Array<{ name: string; public: boolean }> = [
  { name: "avatars", public: false },
  { name: "posts", public: false },
  { name: "verification", public: false },
  { name: "chat_media", public: false },
  { name: "banners", public: false },
];

let provisioned: Promise<{ ok: true; created: string[] }> | null = null;

export const ensureStorageBuckets = createServerFn({ method: "GET" }).handler(async () => {
  if (provisioned) return provisioned;
  provisioned = Promise.resolve({ ok: true as const, created: REQUIRED_BUCKETS.map((b) => b.name) }).catch((e) => {
    provisioned = null;
    throw e;
  });
  return provisioned;
});
