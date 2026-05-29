/** Normalizes `business_cards.blurhashes` from Supabase (text[]). */
export function normalizeBusinessCardBlurhashes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((hash) => (typeof hash === "string" ? hash.trim() : ""))
    .filter((hash) => hash.length > 0);
}

/** Cover blurhash for list thumbnails (`blurhashes[0]` from `business_cards`). */
export function getBusinessCardCoverBlurhash(
  blurhashes?: (string | null)[] | null,
): string | undefined {
  return normalizeBusinessCardBlurhashes(blurhashes)[0];
}
