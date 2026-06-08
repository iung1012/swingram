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
  provisioned = (async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing, error } = await supabaseAdmin.storage.listBuckets();
    if (error) throw error;
    const have = new Set((existing ?? []).map((b) => b.name));
    const created: string[] = [];
    for (const b of REQUIRED_BUCKETS) {
      if (have.has(b.name)) continue;
      const { error: cErr } = await supabaseAdmin.storage.createBucket(b.name, { public: b.public });
      if (cErr && !/already exists/i.test(cErr.message)) throw cErr;
      created.push(b.name);
    }
    return { ok: true as const, created };
  })().catch((e) => {
    provisioned = null;
    throw e;
  });
  return provisioned;
});
