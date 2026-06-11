function parseStringImages(raw: string): string[] {
  const s = raw.trim();
  if (!s) return [];

  // JSON array string, e.g. ["https://...","https://..."]
  if (s.startsWith("[") && s.endsWith("]")) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter((item): item is string => item.length > 0);
      }
    } catch {
      // ignore invalid JSON and continue with other parsing options
    }
  }

  // Postgres text[] literal, e.g. {"https://a","https://b"}
  if (s.startsWith("{") && s.endsWith("}")) {
    const inner = s.slice(1, -1);
    return inner
      .split(",")
      .map((item) => item.replace(/^"(.*)"$/, "$1").trim())
      .filter((item) => item.length > 0);
  }

  // Plain URL string fallback
  return [s];
}

function isLikelyImageUri(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === "null" || normalized === "undefined" || normalized === "nan") return false;
  if (normalized === "[object object]") return false;
  return (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("file://") ||
    normalized.startsWith("content://") ||
    normalized.startsWith("data:image/") ||
    normalized.startsWith("blob:") ||
    normalized.startsWith("/")
  );
}

function extractBusinessCardImageAddedAtMs(url: string): number | null {
  const decoded = decodeURIComponent(url);

  const venueStamp = decoded.match(/venue-(\d{13})-/i);
  if (venueStamp) {
    const ms = Number(venueStamp[1]);
    return Number.isFinite(ms) ? ms : null;
  }

  const seedOrdinal = decoded.match(/\/(\d{2,})\.(?:webp|jpe?g|png|gif|avif)(?:\?|$)/i);
  if (seedOrdinal) {
    const ordinal = Number(seedOrdinal[1]);
    return Number.isFinite(ordinal) ? ordinal : null;
  }

  return null;
}

/** Newest uploads first; falls back to stored array order for undated URLs. */
export function sortBusinessCardImagesByAddedAt(images: string[]): string[] {
  return images
    .map((url, index) => ({ url, index, addedAt: extractBusinessCardImageAddedAtMs(url) }))
    .sort((a, b) => {
      if (a.addedAt !== null && b.addedAt !== null) {
        if (b.addedAt !== a.addedAt) return b.addedAt - a.addedAt;
        return a.index - b.index;
      }
      if (a.addedAt !== null) return -1;
      if (b.addedAt !== null) return 1;
      return a.index - b.index;
    })
    .map((item) => item.url);
}

function dedupeImageUrls(images: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of images) {
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

export function normalizeBusinessCardImages(images: unknown): string[] {
  let parsed: string[] = [];
  if (Array.isArray(images)) {
    parsed = images
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item): item is string => item.length > 0 && isLikelyImageUri(item));
  } else if (typeof images === "string") {
    parsed = parseStringImages(images).filter(isLikelyImageUri);
  }

  return dedupeImageUrls(sortBusinessCardImagesByAddedAt(parsed));
}

/** Newest image in `business_cards.images` (hero / list thumbnail). */
export function getPrimaryBusinessCardImage(images: unknown): string | null {
  const normalized = normalizeBusinessCardImages(images);
  return normalized[0] ?? null;
}

/** @deprecated Alias for {@link getPrimaryBusinessCardImage}. */
export function getLatestBusinessCardImage(images: unknown): string | null {
  return getPrimaryBusinessCardImage(images);
}

export type BusinessCardImageSource = {
  images?: unknown;
  /** Legacy single-image column on older business_cards rows */
  image?: string | null;
};

export function resolveBusinessCardHeroImagesRaw(place: BusinessCardImageSource | null | undefined): {
  heroImagesRaw: string[];
  heroFallback: string | null;
} {
  const legacyImage = place?.image ?? null;
  const normalizedImageList = normalizeBusinessCardImages(place?.images);
  const heroImagesRaw =
    normalizedImageList.length > 0
      ? normalizedImageList
      : [...normalizedImageList, ...normalizeBusinessCardImages(legacyImage)].filter(
          (url, idx, arr) => arr.indexOf(url) === idx,
        );
  const heroFallback = getPrimaryBusinessCardImage(place?.images) ?? getPrimaryBusinessCardImage(legacyImage);
  return { heroImagesRaw, heroFallback };
}
