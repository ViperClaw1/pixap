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

export function normalizeBusinessCardImages(images: unknown): string[] {
  if (Array.isArray(images)) {
    return images
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item): item is string => item.length > 0 && isLikelyImageUri(item));
  }
  if (typeof images === "string") {
    return parseStringImages(images).filter(isLikelyImageUri);
  }
  return [];
}

export function getLatestBusinessCardImage(images: unknown): string | null {
  const normalized = normalizeBusinessCardImages(images);
  if (normalized.length === 0) return null;
  return normalized[normalized.length - 1] ?? null;
}
