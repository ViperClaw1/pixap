import type { BusinessCard } from "../api/useBusinessCards";

export function normalizeAddressKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Loose match between Google formatted address and a stored card address */
export function addressMatchesGoogle(geocodeFormatted: string, cardAddress: string | null | undefined): boolean {
  const g = normalizeAddressKey(geocodeFormatted);
  const c = normalizeAddressKey(cardAddress ?? "");
  if (!g || !c) return false;
  if (g === c) return true;
  if (g.includes(c) || c.includes(g)) return true;
  return false;
}

export function filterBusinessCardsByGeocodeAddress(
  cards: BusinessCard[],
  geocodeFormatted: string,
): BusinessCard[] {
  return cards.filter((card) => addressMatchesGoogle(geocodeFormatted, card.address));
}
