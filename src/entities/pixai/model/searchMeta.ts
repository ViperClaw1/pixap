export type PixAISearchMeta = {
  is_fallback: boolean;
  fts_matched: boolean;
  original_query: string | null;
};

export function buildPixAISearchMeta(
  originalQuery: string | null | undefined,
  places: Array<{ fts_matched?: boolean | null }>,
): PixAISearchMeta {
  const query = (originalQuery ?? "").trim() || null;
  const hasFtsMatch = places.some((place) => place.fts_matched === true);
  const isFallback = Boolean(query) && places.length > 0 && !hasFtsMatch;
  return {
    is_fallback: isFallback,
    fts_matched: hasFtsMatch,
    original_query: query,
  };
}
