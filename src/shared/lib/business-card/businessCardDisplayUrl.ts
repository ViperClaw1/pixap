import { feedMediaDeviceDpr } from "@/shared/lib/feedMediaUrls";
import { getOptimizedImageUrlPreset, type ImagePresetId } from "@/shared/lib/imagePresets";
import { getOptimizedImageUrl, quantizeDecodePx } from "@/shared/lib/imageUtils";
import { resolveStoragePublicUrl } from "@/shared/lib/resolveStoragePublicUrl";
import { normalizeBusinessCardImages } from "@/shared/lib/business-card/businessCardImages";

/** Named targets for business-cards bucket (list cards, hero, fullscreen). */
export type BusinessCardDisplaySize = "list" | "card" | "hero" | "gallery";

const PRESET_BY_SIZE: Record<BusinessCardDisplaySize, ImagePresetId> = {
  list: "thumb",
  card: "small",
  hero: "medium",
  gallery: "large",
};

/** DB path or full URL → public business-cards URL (no resize). */
export function resolveBusinessCardStorageUrl(pathOrUrl?: string | null): string | null {
  if (!pathOrUrl?.trim()) return null;
  const trimmed = pathOrUrl.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return resolveStoragePublicUrl(trimmed, "business-cards");
}

/**
 * Display URL for venue images (Supabase render when transforms enabled).
 * Use `layoutPx` / `layoutPxHeight` when on-screen size is known.
 */
export function getBusinessCardDisplayUrl(
  pathOrUrl?: string | null,
  options?: {
    size?: BusinessCardDisplaySize;
    preset?: ImagePresetId;
    layoutPx?: number;
    layoutPxHeight?: number;
    quality?: number;
  },
): string | null {
  const raw = resolveBusinessCardStorageUrl(pathOrUrl);
  if (!raw) return null;

  const dpr = feedMediaDeviceDpr();
  if (options?.layoutPx != null && options.layoutPx > 0) {
    const w = quantizeDecodePx(Math.round(options.layoutPx * dpr));
    const h =
      options.layoutPxHeight != null && options.layoutPxHeight > 0
        ? quantizeDecodePx(Math.round(options.layoutPxHeight * dpr))
        : undefined;
    return getOptimizedImageUrl(raw, w, h, options.quality ?? 72) || raw;
  }

  const preset = options?.preset ?? PRESET_BY_SIZE[options?.size ?? "card"];
  const optimized = getOptimizedImageUrlPreset(raw, preset, {
    dpr,
    quality: options?.quality,
  });
  return optimized || raw;
}

export function getBusinessCardDisplayUrls(
  images: unknown,
  options?: Parameters<typeof getBusinessCardDisplayUrl>[1],
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const path of normalizeBusinessCardImages(images)) {
    const url = getBusinessCardDisplayUrl(path, options);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

/** Raw public URL for SmartImage fallback when render returns 403. */
export function businessCardDisplayFallback(
  displayUri: string | null | undefined,
  pathOrUrl?: string | null,
): string | undefined {
  const raw = resolveBusinessCardStorageUrl(pathOrUrl);
  if (!raw || !displayUri || raw === displayUri) return undefined;
  return raw;
}
