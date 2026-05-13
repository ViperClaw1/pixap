import { supabase } from "@/shared/api/supabase/client";

/** Parses `stories.media_url`: JSON array of URLs or a single URL string. */
export function parseStoryMediaUrls(raw?: string | null): string[] {
  const value = raw?.trim();
  if (!value) return [];
  if (value.startsWith("[")) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
      }
    } catch {
      return [];
    }
  }
  return [value];
}

export function resolveStoryStorageUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return supabase.storage.from("stories").getPublicUrl(pathOrUrl).data.publicUrl;
}
