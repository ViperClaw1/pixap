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

export function normalizeBusinessCardImages(images: unknown): string[] {
  if (Array.isArray(images)) {
    return images
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item): item is string => item.length > 0);
  }
  if (typeof images === "string") {
    return parseStringImages(images);
  }
  return [];
}

export function getLatestBusinessCardImage(images: unknown): string | null {
  const normalized = normalizeBusinessCardImages(images);
  if (normalized.length === 0) return null;
  return normalized[normalized.length - 1] ?? null;
}
