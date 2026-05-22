/** Exclude fast food, chains, and beer-focused venues when seeding restaurants. */

const EXCLUDED_TYPES = new Set([
  "fast_food",
  "meal_takeaway",
  "meal_delivery",
  "convenience_store",
  "supermarket",
  "gas_station",
  "liquor_store",
]);

/** Name hints for QSR, chains, beer halls (case-insensitive). */
const EXCLUDED_NAME_RE =
  /\b(mcdonald|mcdonalds|burger\s*king|kfc|subway|domino'?s?|pizza\s*hut|taco\s*bell|wendy'?s?|chipotle|starbucks|dunkin|five\s*guys|in-?n-?out|pret\s*a\s*manger|greggs|wetherspoon|brewdog|beer\s*hall|brewhouse|brewery|biergarten|gastropub|pub\s*&\s*grill|fast\s*food|drive\s*thru|drive-thru|шаурм|шаверм|додо\s*пицц|döner|doner\s*kebab|kebab)\b/i;

/**
 * @param {import('./googleMaps.mjs').GooglePlaceCandidate | { name?: string, types?: string[], price_level?: number }} place
 * @returns {{ ok: boolean, reason?: string }}
 */
export function assessUpscaleRestaurant(place) {
  const name = place.name?.trim() ?? "";
  const types = place.types ?? [];

  if (EXCLUDED_NAME_RE.test(name)) {
    return { ok: false, reason: `excluded chain/casual name "${name}"` };
  }

  for (const t of types) {
    if (EXCLUDED_TYPES.has(t)) {
      return { ok: false, reason: `excluded type "${t}"` };
    }
  }

  if (types.includes("bar") && !types.includes("restaurant")) {
    return { ok: false, reason: "bar without restaurant type" };
  }

  if (types.includes("night_club")) {
    return { ok: false, reason: "night_club type" };
  }

  const price = place.price_level;
  if (typeof price === "number" && price < 2) {
    return { ok: false, reason: `price_level ${price} ($/$$ only)` };
  }

  const foodish =
    types.includes("restaurant") ||
    types.includes("food") ||
    types.includes("cafe") ||
    types.includes("meal_delivery");
  if (!foodish && types.length > 0) {
    return { ok: false, reason: `not a restaurant POI (types: ${types.slice(0, 4).join(", ")})` };
  }

  return { ok: true };
}
