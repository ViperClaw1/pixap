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
