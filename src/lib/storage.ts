import { supabase } from "@/integrations/supabase/client";

export async function uploadToBucket(bucket: string, userId: string, file: File, subdir = "") {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${userId}/${subdir ? subdir + "/" : ""}${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function signedUrl(bucket: string, path: string, seconds = 3600) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, seconds);
  if (error) throw error;
  return data.signedUrl;
}
