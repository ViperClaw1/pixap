const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Treats empty/invalid values as null so Postgres uuid columns are not fed `''` or bad strings. */
export function normalizeOptionalUuid(value: string | null | undefined): string | null {
  const t = typeof value === "string" ? value.trim() : "";
  if (!t) return null;
  return UUID_RE.test(t) ? t : null;
}
