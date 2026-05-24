import { resolveAvatarPregeneratedThumbUrl } from "@/shared/lib/avatar/avatarPregenStorage";
import { resolveStoragePublicUrl } from "@/shared/lib/resolveStoragePublicUrl";
import { feedMediaDeviceDpr } from "@/shared/lib/feedMediaUrls";
import { getOptimizedImageUrl, quantizeDecodePx } from "@/shared/lib/imageUtils";

/** Typical on-screen avatar sizes (px) before DPR scaling. */
export type AvatarDisplaySize = "xs" | "sm" | "md" | "lg" | "xl";

const LAYOUT_PX: Record<AvatarDisplaySize, number> = {
  xs: 22,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 132,
};

/** DB path or full URL → public avatars bucket URL (no resize). */
export function resolveAvatarStorageUrl(pathOrUrl?: string | null): string | null {
  if (!pathOrUrl?.trim()) return null;
  const trimmed = pathOrUrl.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return resolveStoragePublicUrl(trimmed, "avatars");
}

/**
 * Display URL for avatars (Supabase render when transforms enabled).
 * Pass `layoutPx` from component width/height when known.
 */
export function getAvatarDisplayUrl(
  pathOrUrl?: string | null,
  options?: { size?: AvatarDisplaySize; layoutPx?: number },
): string | null {
  const raw = resolveAvatarStorageUrl(pathOrUrl);
  if (!raw) return null;

  const pregen = resolveAvatarPregeneratedThumbUrl(pathOrUrl);
  if (pregen) return pregen;

  const layoutPx = options?.layoutPx ?? LAYOUT_PX[options?.size ?? "md"];
  const edge = quantizeDecodePx(Math.round(layoutPx * feedMediaDeviceDpr()));
  return getOptimizedImageUrl(raw, edge, edge, 72) || raw;
}
