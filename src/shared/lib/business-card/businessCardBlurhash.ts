/** Cover blurhash for list thumbnails (`blurhashes[0]` from `business_cards`). */
export function getBusinessCardCoverBlurhash(
  blurhashes?: (string | null)[] | null,
): string | undefined {
  const hash = blurhashes?.[0];
  return typeof hash === "string" && hash.trim().length > 0 ? hash.trim() : undefined;
}
