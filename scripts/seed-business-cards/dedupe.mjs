import { log } from "./lib.mjs";

/** Normalize address for cross-run dedupe (Google formatting may vary slightly). */
export function normalizeListingAddress(address) {
  if (!address) return "";
  return address
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeListingName(name) {
  return name?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

export function listingDedupeKey(name, address) {
  return `${normalizeListingName(name)}|${normalizeListingAddress(address)}`;
}

/**
 * @typedef {{ addresses: Set<string>, nameAddressKeys: Set<string>, countByCity: Map<string, number> }} ExistingVenueIndex
 */

/**
 * Load existing catalogue rows to avoid re-inserting the same POI on repeat runs.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {{ cities: string[], categoryId?: string | null, allCities?: boolean }} options
 * @returns {Promise<ExistingVenueIndex>}
 */
export async function loadExistingVenueIndex(supabase, { cities, categoryId = null, allCities = false }) {
  const index = {
    addresses: new Set(),
    nameAddressKeys: new Set(),
    countByCity: new Map(),
  };

  if (!allCities && !cities.length) return index;

  let query = supabase.from("business_cards").select("name, address, city").limit(5000);
  if (!allCities) {
    query = query.in("city", cities);
  }

  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load existing business_cards: ${error.message}`);

  for (const row of data ?? []) {
    const addr = normalizeListingAddress(row.address);
    if (addr) index.addresses.add(addr);
    index.nameAddressKeys.add(listingDedupeKey(row.name, row.address));
    const city = row.city ?? "";
    index.countByCity.set(city, (index.countByCity.get(city) ?? 0) + 1);
  }

  const scopeLabel = allCities ? "all cities" : `${cities.length} city/cities`;
  log(
    "dedupe",
    `Loaded ${data?.length ?? 0} existing row(s) in ${scopeLabel} (${index.addresses.size} unique addresses)`,
  );

  return index;
}

export function isDuplicateListing(name, address, index) {
  const addr = normalizeListingAddress(address);
  if (addr && index.addresses.has(addr)) return "address already in business_cards";
  const key = listingDedupeKey(name, address);
  if (index.nameAddressKeys.has(key)) return "name+address already in business_cards";
  return null;
}

/** Register a row about to be inserted so later slots in the same run stay unique. */
export function registerPreparedListing(name, address, cityLabel, index) {
  const addr = normalizeListingAddress(address);
  if (addr) index.addresses.add(addr);
  index.nameAddressKeys.add(listingDedupeKey(name, address));
  index.countByCity.set(cityLabel, (index.countByCity.get(cityLabel) ?? 0) + 1);
}

export function existingCountForCity(cityLabel, index) {
  return index.countByCity.get(cityLabel) ?? 0;
}
