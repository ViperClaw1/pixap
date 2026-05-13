/**
 * Parses `media_blurhashes` jsonb from Postgres / Supabase (parallel to media URLs).
 */
export function parseMediaBlurhashesColumn(raw: unknown): (string | null)[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  const out = raw.map((x) => (typeof x === "string" && x.trim().length > 0 ? x.trim() : null));
  if (out.every((x) => x == null)) return null;
  return out;
}
