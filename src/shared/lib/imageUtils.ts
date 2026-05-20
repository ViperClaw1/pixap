import { env } from "@/shared/lib/env";

/**
 * Supabase Storage Image Transformations (`/render/image/`) require Pro + Dashboard toggle.
 * Without it, transformed URLs return 403 and break feed/story media in the app.
 * Set `EXPO_PUBLIC_SUPABASE_IMAGE_TRANSFORM=1` after enabling transforms in the project.
 */
export function isSupabaseImageTransformEnabled(): boolean {
  return env.supabaseImageTransformEnabled;
}

/** Original `/object/public/` URL when a `/render/image/public/` request fails (403 before Pro/transforms). */
export function getSupabaseStorageObjectFallbackUrl(url: string): string | null {
  if (!url.includes("supabase.co/storage/v1/render/image/public/")) return null;
  const pathOnly = url.split("?")[0]?.split("#")[0] ?? url;
  const objectPath = pathOnly.replace("/storage/v1/render/image/public/", "/storage/v1/object/public/");
  if (objectPath === pathOnly) return null;
  const hash = url.includes("#") ? url.slice(url.indexOf("#")) : "";
  return `${objectPath}${hash}`;
}

/**
 * Buckets decode dimensions so small layout/DPR changes do not rewrite Supabase render URLs (stable cache keys).
 */
export function quantizeDecodePx(px: number, step = 64, min = 128): number {
  return Math.max(min, Math.round(Math.max(min, px) / step) * step);
}

/**
 * Optimized image URL for list thumbnails (Supabase render API when enabled on the project).
 */
export function getOptimizedImageUrl(
  url: string | null | undefined,
  width: number,
  height?: number,
  quality = 75,
): string {
  if (!url) return "";

  const pathOnly = url.split("?")[0] ?? url;
  /** Supabase render/image is for rasters; video URLs break the grid if passed here. */
  if (/\.(mp4|webm|mov|m4v|avi|mkv)(\?|$)/i.test(pathOnly)) {
    return url;
  }

  if (isSupabaseImageTransformEnabled() && url.includes("supabase.co/storage/v1/object/public/")) {
    const params = new URLSearchParams();
    params.set("width", String(width));
    if (height) params.set("height", String(height));
    params.set("quality", String(quality));
    const transformed = url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
    return `${transformed}?${params.toString()}`;
  }

  if (url.includes("images.unsplash.com")) {
    try {
      const u = new URL(url);
      u.searchParams.set("w", String(width));
      if (height) u.searchParams.set("h", String(height));
      u.searchParams.set("q", String(quality));
      u.searchParams.set("auto", "format");
      return u.toString();
    } catch {
      return url;
    }
  }

  return url;
}

export function getOptimizedImageUrls(
  urls: Array<string | null | undefined>,
  width: number,
  height?: number,
  quality = 75,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const url of urls) {
    const optimized = getOptimizedImageUrl(url, width, height, quality);
    if (!optimized) continue;
    if (seen.has(optimized)) continue;
    seen.add(optimized);
    out.push(optimized);
  }
  return out;
}
