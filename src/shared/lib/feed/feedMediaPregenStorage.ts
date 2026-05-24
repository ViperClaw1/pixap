import { resolveStoragePublicUrl } from "@/shared/lib/resolveStoragePublicUrl";

export const POST_FEED_SUFFIX = "_feed";
export const STORY_DISPLAY_SUFFIX = "_story";
export const POST_FEED_FILE = `${POST_FEED_SUFFIX}.webp`;
export const STORY_DISPLAY_FILE = `${STORY_DISPLAY_SUFFIX}.webp`;

export const POST_FEED_PREGEN_LONG_EDGE = 720;
export const STORY_DISPLAY_PREGEN_LONG_EDGE = 1080;

const STORIES_OBJECT_PUBLIC = "/storage/v1/object/public/stories/";

const PREGEN_FILES = new Set([POST_FEED_FILE, STORY_DISPLAY_FILE]);

export function isStoriesBucketStorageUrl(url: string): boolean {
  return url.toLowerCase().includes("supabase.co/storage/v1/object/public/stories/");
}

export function storiesStorageObjectPath(pathOrUrl: string): string | null {
  const trimmed = pathOrUrl.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  const idx = lower.indexOf(STORIES_OBJECT_PUBLIC);
  if (idx >= 0) {
    const rest = trimmed.slice(idx + STORIES_OBJECT_PUBLIC.length).split("?")[0]?.split("#")[0] ?? "";
    return rest.replace(/^\/+/, "") || null;
  }
  if (/^https?:\/\//i.test(trimmed)) return null;
  return trimmed.replace(/^\/+/, "") || null;
}

function pregenStoragePath(pathOrUrl: string, pregenFile: string): string | null {
  const objectPath = storiesStorageObjectPath(pathOrUrl);
  if (!objectPath || PREGEN_FILES.has(objectPath)) return null;
  if (objectPath.endsWith(pregenFile)) return objectPath;
  const base = objectPath.replace(/\.[^./]+$/, "");
  if (!base || base === objectPath) return null;
  return `${base}${pregenFile}`;
}

export function postFeedPregenStoragePath(pathOrUrl: string): string | null {
  return pregenStoragePath(pathOrUrl, POST_FEED_FILE);
}

export function storyDisplayPregenStoragePath(pathOrUrl: string): string | null {
  return pregenStoragePath(pathOrUrl, STORY_DISPLAY_FILE);
}

export function resolvePostFeedPregeneratedUrl(pathOrUrl?: string | null): string | null {
  if (!pathOrUrl?.trim()) return null;
  const pregenPath = postFeedPregenStoragePath(pathOrUrl);
  if (!pregenPath) return null;
  return resolveStoragePublicUrl(pregenPath, "stories");
}

export function resolveStoryDisplayPregeneratedUrl(pathOrUrl?: string | null): string | null {
  if (!pathOrUrl?.trim()) return null;
  const pregenPath = storyDisplayPregenStoragePath(pathOrUrl);
  if (!pregenPath) return null;
  return resolveStoragePublicUrl(pregenPath, "stories");
}
