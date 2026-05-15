import { supabase } from "@/shared/api/supabase/client";

export function resolveStoragePublicUrl(
  pathOrUrl: string,
  bucket: "avatars" | "business-cards" | "stories",
): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return supabase.storage.from(bucket).getPublicUrl(pathOrUrl).data.publicUrl;
}
