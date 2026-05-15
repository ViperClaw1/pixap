import type { FeedPostItem } from "@/entities/post";
import { resolveStoragePublicUrl } from "@/shared/lib/resolveStoragePublicUrl";

export const resolveStorageUrl = resolveStoragePublicUrl;

export function profileName(first?: string | null, last?: string | null) {
  return `${first?.trim() ?? ""} ${last?.trim() ?? ""}`.trim() || "Unknown user";
}

export function profileAvatar(pathOrUrl?: string | null) {
  if (!pathOrUrl?.trim()) return null;
  return resolveStorageUrl(pathOrUrl, "avatars");
}

export function parseMediaUrls(raw?: string | null): string[] {
  const value = raw?.trim();
  if (!value) return [];
  if (value.startsWith("[")) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
      }
    } catch {
      return [];
    }
  }
  return [value];
}

export function getPostImages(post: FeedPostItem) {
  const postMediaUrls = parseMediaUrls(post.media_url);
  return Array.from(new Set(postMediaUrls.map((url) => resolveStorageUrl(url, "stories"))));
}

export function slideBlurhashesForPost(post: FeedPostItem, slideCount: number): (string | null)[] {
  const raw = post.media_blurhashes;
  if (!raw?.length) return Array.from({ length: slideCount }, () => null);
  return Array.from({ length: slideCount }, (_, i) => raw[i] ?? null);
}

export type FeedPostVm = {
  post: FeedPostItem;
  postImagesRaw: string[];
  postImages: string[];
  postSlideBlurhashes: (string | null)[];
  authorAvatarRaw: string | null;
  authorAvatar: string | null;
};
