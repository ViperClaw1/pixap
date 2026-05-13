/**
 * Buckets decode dimensions so small layout/DPR changes do not rewrite Supabase render URLs (stable cache keys).
 */
export function quantizeDecodePx(px: number, step = 64, min = 128): number {
  return Math.max(min, Math.round(Math.max(min, px) / step) * step);
}

/**
 * Optimized image URL for list thumbnails (Supabase render API when applicable).
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

  if (url.includes("supabase.co/storage/v1/object/public/")) {
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
