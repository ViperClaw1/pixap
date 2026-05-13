import { getOptimizedImageUrl, quantizeDecodePx } from "@/shared/lib/imageUtils";

export type ImagePresetId = "thumb" | "small" | "medium" | "large";

/** Named decode targets (single object in storage; URL built via Supabase render). */
export const IMAGE_PRESETS: Record<
  ImagePresetId,
  { width: number; height?: number; quality: number }
> = {
  thumb: { width: 128, height: 128, quality: 72 },
  small: { width: 320, height: 320, quality: 72 },
  medium: { width: 720, height: 420, quality: 76 },
  large: { width: 1080, height: 1920, quality: 78 },
};

export type ImagePresetOptions = {
  /** When set, dimensions are multiplied by DPR then quantized (stable cache keys). */
  dpr?: number;
  /** Override default quality from preset. */
  quality?: number;
};

export function getOptimizedImageUrlPreset(
  url: string | null | undefined,
  preset: ImagePresetId,
  options?: ImagePresetOptions,
): string {
  if (!url) return "";
  const def = IMAGE_PRESETS[preset];
  const q = options?.quality ?? def.quality;
  const scale = options?.dpr && options.dpr > 0 ? options.dpr : 1;
  const w = quantizeDecodePx(Math.round(def.width * scale));
  const h = def.height != null ? quantizeDecodePx(Math.round(def.height * scale)) : undefined;
  return getOptimizedImageUrl(url, w, h, q);
}

export function getOptimizedImageUrlPresets(
  urls: Array<string | null | undefined>,
  preset: ImagePresetId,
  options?: ImagePresetOptions,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const url of urls) {
    const optimized = getOptimizedImageUrlPreset(url, preset, options);
    if (!optimized) continue;
    if (seen.has(optimized)) continue;
    seen.add(optimized);
    out.push(optimized);
  }
  return out;
}
