function normalizeCityKey(city: string): string {
  return city.trim().toLowerCase();
}

function cityNameWithoutCountry(city: string): string {
  const [name] = city.split(",");
  return (name ?? city).trim();
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

/** Finds a known city mentioned in free text, typo-tolerant. Returns the full catalog value or null. */
export function extractCityFromQuery(query: string, knownCities: string[]): string | null {
  const words = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return null;

  for (const city of knownCities) {
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

export function cityLabelWithoutCountry(city: string): string {
  return cityNameWithoutCountry(city);
}

export function normalizeCityList(cities: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of cities) {
    const city = raw.trim();
    if (!city) continue;
    const key = normalizeCityKey(city);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(city);
  }
  return out;
}
