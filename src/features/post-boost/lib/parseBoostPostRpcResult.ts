/** Normalizes `boost_post` RPC payload (scalar timestamptz or JSON) to ISO string. */
export function parseBoostPostRpcResult(data: unknown): string {
  if (typeof data === "string") {
    const trimmed = data.trim();
    if (!trimmed) return new Date().toISOString();
    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed) as { boosted_at?: unknown };
        if (typeof parsed.boosted_at === "string" && parsed.boosted_at.trim()) {
          return parsed.boosted_at;
        }
      } catch {
        /* use raw string below */
      }
    }
    return trimmed;
  }
  if (data != null && typeof data === "object") {
    const row = data as Record<string, unknown>;
    if (typeof row.boosted_at === "string" && row.boosted_at.trim()) {
      return row.boosted_at;
    }
  }
  return new Date().toISOString();
}
