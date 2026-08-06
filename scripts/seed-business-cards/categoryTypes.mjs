import { CATEGORY_IDS, cloneVenueDefinition } from "./lib.mjs";

/**
 * App `public.categories.name` → seed profile + Google Places search.
 * Aliases: display name (Restaurants), plural key (restaurants), photoPool (restaurant).
 */
export const SEED_CATEGORY_TYPES = {
  Restaurants: {
    key: "restaurants",
    categoryId: CATEGORY_IDS.restaurants,
    photoPool: "restaurant",
  },
  Bars: {
    key: "bars",
    categoryId: CATEGORY_IDS.bars,
    photoPool: "bar",
  },
  Beauty: {
    key: "beauty",
    categoryId: CATEGORY_IDS.beauty,
    photoPool: "beauty",
  },
  Clubs: {
    key: "clubs",
    categoryId: CATEGORY_IDS.clubs,
    photoPool: "club",
  },
  Entertainment: {
    key: "entertainment",
    categoryId: CATEGORY_IDS.entertainment,
    photoPool: "coworking",
  },
  Fitness: {
    key: "fitness",
    categoryId: CATEGORY_IDS.fitness,
    photoPool: "gym",
  },
  Hotels: {
    key: "hotels",
    categoryId: CATEGORY_IDS.hotels,
    photoPool: "hotel",
  },
  Tourism: {
    key: "tourism",
    categoryId: CATEGORY_IDS.tourism,
    photoPool: "tourism",
  },
};

const ALIASES = Object.entries(SEED_CATEGORY_TYPES).flatMap(([displayName, spec]) => [
  [displayName.toLowerCase(), displayName],
  [spec.key, displayName],
  [spec.photoPool, displayName],
]);

/**
 * @param {string} raw e.g. `Restaurants`, `restaurants`, `restaurant`
 * @returns {{ displayName: string, key: string, categoryId: string, photoPool: string }}
 */
export function resolveSeedCategoryType(raw) {
  const needle = raw.trim().toLowerCase();
  if (!needle) {
    throw new Error("--type requires a category name (e.g. Restaurants)");
  }

  for (const [alias, displayName] of ALIASES) {
    if (alias === needle) {
      return { displayName, ...SEED_CATEGORY_TYPES[displayName] };
    }
  }

  const valid = Object.keys(SEED_CATEGORY_TYPES).join(", ");
  throw new Error(`Unknown --type "${raw}". Valid values: ${valid}`);
}

/** @param {Array<{ categoryId: string, photoPool: string, slug: string, seedOffset: number }>} allDefinitions */
export function selectVenueDefinitions(allDefinitions, categoryType, count) {
  let pool = allDefinitions;
  if (categoryType) {
    pool = allDefinitions.filter((v) => v.categoryId === categoryType.categoryId);
    if (!pool.length) {
      throw new Error(`No venue templates for category ${categoryType.displayName}`);
    }
  }

  if (pool.length >= count) {
    return pool
      .slice(0, count)
      .map((venue) => applyCategoryTypeToVenue(cloneVenueDefinition(venue), categoryType));
  }

  const out = [];
  for (let i = 0; i < count; i += 1) {
    const base = pool[i % pool.length];
    const cycle = Math.floor(i / pool.length);
    const cloned = cloneVenueDefinition(base);
    cloned.slug = cycle === 0 ? base.slug : `${base.slug}-run-${String(i + 1).padStart(2, "0")}`;
    cloned.seedOffset = base.seedOffset + cycle * 13 + i;
    out.push(applyCategoryTypeToVenue(cloned, categoryType));
  }
  return out;
}

function applyCategoryTypeToVenue(venue, categoryType) {
  if (!categoryType) return venue;
  return {
    ...venue,
    categoryId: categoryType.categoryId,
    photoPool: categoryType.photoPool,
  };
}
