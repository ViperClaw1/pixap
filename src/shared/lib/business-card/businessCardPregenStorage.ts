import { resolveStoragePublicUrl } from "@/shared/lib/resolveStoragePublicUrl";

export const BUSINESS_CARD_THUMB_SUFFIX = "_thumb";
export const BUSINESS_CARD_HERO_SUFFIX = "_hero";
export const BUSINESS_CARD_GALLERY_SUFFIX = "_gallery";

export const BUSINESS_CARD_THUMB_FILE = `${BUSINESS_CARD_THUMB_SUFFIX}.webp`;
export const BUSINESS_CARD_HERO_FILE = `${BUSINESS_CARD_HERO_SUFFIX}.webp`;
export const BUSINESS_CARD_GALLERY_FILE = `${BUSINESS_CARD_GALLERY_SUFFIX}.webp`;

/** Long edges for pre-generated variants (`object/public`, no render quota). */
export const BUSINESS_CARD_THUMB_LONG_EDGE = 256;
export const BUSINESS_CARD_HERO_LONG_EDGE = 720;
export const BUSINESS_CARD_GALLERY_LONG_EDGE = 1080;

export type BusinessCardPregenVariant = "thumb" | "hero" | "gallery";

const PREGEN_FILE_BY_VARIANT: Record<BusinessCardPregenVariant, string> = {
  thumb: BUSINESS_CARD_THUMB_FILE,
  hero: BUSINESS_CARD_HERO_FILE,
  gallery: BUSINESS_CARD_GALLERY_FILE,
};

const BUSINESS_CARDS_OBJECT_PUBLIC = "/storage/v1/object/public/business-cards/";

/** True when URL points at our `business-cards` bucket (not external Unsplash/Picsum). */
export function isBusinessCardsStorageUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes("supabase.co/storage/v1/object/public/business-cards/");
}

/** Extract storage object path from a public URL, or return trimmed relative path. */
export function businessCardStorageObjectPath(pathOrUrl: string): string | null {
  const trimmed = pathOrUrl.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  const idx = lower.indexOf(BUSINESS_CARDS_OBJECT_PUBLIC);
  if (idx >= 0) {
    const rest = trimmed.slice(idx + BUSINESS_CARDS_OBJECT_PUBLIC.length).split("?")[0]?.split("#")[0] ?? "";
    return rest.replace(/^\/+/, "") || null;
  }
  if (/^https?:\/\//i.test(trimmed)) return null;
  return trimmed.replace(/^\/+/, "") || null;
}

function isPregenObjectPath(objectPath: string): boolean {
  return (
    objectPath.endsWith(BUSINESS_CARD_THUMB_FILE) ||
    objectPath.endsWith(BUSINESS_CARD_HERO_FILE) ||
    objectPath.endsWith(BUSINESS_CARD_GALLERY_FILE)
  );
}

/** `seed/places/x/01.jpg` → `seed/places/x/01_thumb.webp` (etc.). */
export function businessCardPregenStoragePath(
  pathOrUrl: string,
  variant: BusinessCardPregenVariant,
): string | null {
  const objectPath = businessCardStorageObjectPath(pathOrUrl);
  if (!objectPath || isPregenObjectPath(objectPath)) return null;
  const pregenFile = PREGEN_FILE_BY_VARIANT[variant];
  if (objectPath.endsWith(pregenFile)) return objectPath;
  const base = objectPath.replace(/\.[^./]+$/, "");
  if (!base || base === objectPath) return null;
  return `${base}${pregenFile}`;
}

/** Public object URL for a pre-generated variant, or null for external sources. */
export function resolveBusinessCardPregeneratedUrl(
  pathOrUrl?: string | null,
  variant: BusinessCardPregenVariant = "thumb",
): string | null {
  if (!pathOrUrl?.trim()) return null;
  const pregenPath = businessCardPregenStoragePath(pathOrUrl, variant);
  if (!pregenPath) return null;
  return resolveStoragePublicUrl(pregenPath, "business-cards");
}

/** @deprecated Use {@link resolveBusinessCardPregeneratedUrl} with variant `thumb`. */
export function businessCardThumbStoragePath(pathOrUrl: string): string | null {
  return businessCardPregenStoragePath(pathOrUrl, "thumb");
}

/** @deprecated Use {@link resolveBusinessCardPregeneratedUrl} with variant `thumb`. */
export function resolveBusinessCardPregeneratedThumbUrl(pathOrUrl?: string | null): string | null {
  return resolveBusinessCardPregeneratedUrl(pathOrUrl, "thumb");
}
