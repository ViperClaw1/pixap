/** CDN-friendly Cache-Control for immutable uploads (unique path per upload). */
export const STORAGE_CACHE_CONTROL_IMMUTABLE = "public, max-age=31536000, immutable";

/** Avatars and rare overwrites — shorter TTL. */
export const STORAGE_CACHE_CONTROL_STANDARD = "public, max-age=86400";

export type StorageCacheProfile = "immutable" | "standard";

export function storageCacheControlForProfile(profile: StorageCacheProfile): string {
  return profile === "immutable" ? STORAGE_CACHE_CONTROL_IMMUTABLE : STORAGE_CACHE_CONTROL_STANDARD;
}

export function buildStorageUploadOptions(contentType: string, profile: StorageCacheProfile = "immutable") {
  return {
    contentType,
    cacheControl: storageCacheControlForProfile(profile),
    upsert: true as const,
  };
}
