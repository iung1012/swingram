import { api } from "@/integrations/api/client";
import { resolveApiBaseUrl } from "@/lib/api-base";

export async function uploadToBucket(bucket: string, userId: string, file: File, subdir = "") {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${userId}/${subdir ? subdir + "/" : ""}${crypto.randomUUID()}.${ext}`;
  const { error } = await api.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

function normalizeUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  return new URL(url, resolveApiBaseUrl()).toString();
}

export async function signedUrl(bucket: string, path: string, seconds = 3600) {
  const { data, error } = await api.storage.from(bucket).createSignedUrl(path, seconds);
  if (error) throw error;
  return normalizeUrl(data.signedUrl);
}

