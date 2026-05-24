import { resolveStoragePublicUrl } from "@/shared/lib/resolveStoragePublicUrl";

export const AVATAR_THUMB_SUFFIX = "_thumb";
export const AVATAR_THUMB_FILE = `${AVATAR_THUMB_SUFFIX}.webp`;

/** Long edge for pre-generated avatar thumbs (`object/public`, no render quota). */
export const AVATAR_THUMB_PREGEN_LONG_EDGE = 256;

const AVATARS_OBJECT_PUBLIC = "/storage/v1/object/public/avatars/";

export function isAvatarsStorageUrl(url: string): boolean {
  return url.toLowerCase().includes(AVATARS_OBJECT_PUBLIC);
}

export function avatarStorageObjectPath(pathOrUrl: string): string | null {
  const trimmed = pathOrUrl.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  const idx = lower.indexOf(AVATARS_OBJECT_PUBLIC);
  if (idx >= 0) {
    const rest = trimmed.slice(idx + AVATARS_OBJECT_PUBLIC.length).split("?")[0]?.split("#")[0] ?? "";
    return rest.replace(/^\/+/, "") || null;
  }
  if (/^https?:\/\//i.test(trimmed)) return null;
  return trimmed.replace(/^\/+/, "") || null;
}

/** `userId/123.jpg` → `userId/123_thumb.webp` */
export function avatarThumbPregenStoragePath(pathOrUrl: string): string | null {
  const objectPath = avatarStorageObjectPath(pathOrUrl);
  if (!objectPath || objectPath.endsWith(AVATAR_THUMB_FILE)) return null;
  const base = objectPath.replace(/\.[^./]+$/, "");
  if (!base || base === objectPath) return null;
  return `${base}${AVATAR_THUMB_FILE}`;
}

export function resolveAvatarPregeneratedThumbUrl(pathOrUrl?: string | null): string | null {
  if (!pathOrUrl?.trim()) return null;
  const pregenPath = avatarThumbPregenStoragePath(pathOrUrl);
  if (!pregenPath) return null;
  return resolveStoragePublicUrl(pregenPath, "avatars");
}
