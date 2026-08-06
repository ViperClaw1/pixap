import { ALL_CITIES_OPTION } from "../api/useBusinessCards";

/**
 * Maps business_cards.city strings to a display country. Cities not listed resolve to "Other".
 * Extend CITY_TO_COUNTRY when onboarding new regions.
 */
const CITY_TO_COUNTRY: Record<string, string> = {
  // United Arab Emirates
  dubai: "United Arab Emirates",
  "abu dhabi": "United Arab Emirates",
  sharjah: "United Arab Emirates",
  ajman: "United Arab Emirates",
  "ras al khaimah": "United Arab Emirates",
  fujairah: "United Arab Emirates",
  "umm al quwain": "United Arab Emirates",
  "al ain": "United Arab Emirates",
  // Saudi Arabia
  riyadh: "Saudi Arabia",
  jeddah: "Saudi Arabia",
  mecca: "Saudi Arabia",
  medina: "Saudi Arabia",
  dammam: "Saudi Arabia",
  khobar: "Saudi Arabia",
  "al khobar": "Saudi Arabia",
  // Qatar
  doha: "Qatar",
  // Kuwait
  "al kuwait": "Kuwait",
  kuwait: "Kuwait",
  // Bahrain
  manama: "Bahrain",
  // Oman
  muscat: "Oman",
  // Egypt (common tourism)
  cairo: "Egypt",
  alexandria: "Egypt",
  sharm: "Egypt",
  "sharm el sheikh": "Egypt",
  hurghada: "Egypt",
  luxor: "Egypt",
  // Turkey
  istanbul: "Turkey",
  ankara: "Turkey",
  izmir: "Turkey",
  antalya: "Turkey",
  bodrum: "Turkey",
  // Europe (examples)
  paris: "France",
  london: "United Kingdom",
  barcelona: "Spain",
  madrid: "Spain",
  rome: "Italy",
  milan: "Italy",
  berlin: "Germany",
  amsterdam: "Netherlands",
  // US / generic
  "new york": "United States",
  miami: "United States",
  "los angeles": "United States",
};

function normalizeCityKey(city: string): string {
  return city.trim().toLowerCase();
}

function extractCountryFromCitySuffix(city: string): string | null {
  const parts = city
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  return parts[parts.length - 1] ?? null;
}

export function countryLabelForCity(city: string): string {
  const extractedCountry = extractCountryFromCitySuffix(city);
  if (extractedCountry) return extractedCountry;
  return CITY_TO_COUNTRY[normalizeCityKey(city)] ?? "Other";
}

/** Strips a ", Country" suffix, e.g. "Almaty, Kazakhstan" -> "Almaty". */
export function cityNameWithoutCountry(city: string): string {
  const [name] = city.split(",");
  return (name ?? city).trim();
}

export type CityCountryGroup = { country: string; cities: string[] };

export function groupCitiesByCountry(cityNames: string[]): CityCountryGroup[] {
  const byCountry = new Map<string, string[]>();
  for (const city of cityNames) {
    const label = countryLabelForCity(city);
    const list = byCountry.get(label) ?? [];
    list.push(city);
    byCountry.set(label, list);
  }
  for (const list of byCountry.values()) {
    list.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }
  return Array.from(byCountry.entries())
    .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: "base" }))
    .map(([country, cities]) => ({ country, cities }));
}

export function matchesSearchTokens(haystack: string, query: string): boolean {
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return true;
  const h = haystack.trim().toLowerCase();
  return tokens.every((t) => h.includes(t));
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[b.length];
}

// ponytail: local fuzzy match against the known (small, finite) city list — swap for a
// Gemini extraction call if abbreviations ("SF", "NYC") or transliteration need covering.
/** Finds a known city mentioned in free text, typo-tolerant. Returns the full "City, Country" value or null. */
export function extractCityFromQuery(query: string, knownCities: string[]): string | null {
  const words = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return null;

  for (const city of knownCities) {
    if (city === ALL_CITIES_OPTION) continue;
    const shortName = cityNameWithoutCountry(city).toLowerCase();
    const cityWords = shortName.split(/\s+/).filter(Boolean);
    if (cityWords.length === 0 || cityWords.length > words.length) continue;
    for (let i = 0; i <= words.length - cityWords.length; i++) {
      const window = words.slice(i, i + cityWords.length).join(" ");
      const maxDist = window.length <= 4 ? 0 : window.length <= 8 ? 1 : 2;
      if (levenshtein(window, shortName) <= maxDist) return city;
    }
  }
  return null;
}

export function filterCityGroups(groups: CityCountryGroup[], query: string): CityCountryGroup[] {
  const q = query.trim();
  if (!q) return groups;
  return groups
    .map(({ country, cities }) => ({
      country,
      cities: cities.filter((city) => matchesSearchTokens(`${country} ${city}`, q)),
    }))
    .filter((g) => g.cities.length > 0);
}
