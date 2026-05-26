export const RECOMMENDED_BATCH_SIZE = 20;
export const RECOMMENDED_ITEM_ESTIMATED_SIZE = 156;
export const CATEGORY_PILL_ESTIMATED_WIDTH = 148;
export const FEATURED_CARD_ESTIMATED_WIDTH = 168;

export const HOME_CATEGORY_ORDER = [
  "Bars",
  "Clubs",
  "Restaurants",
  "Tourism",
  "Entertainment",
  "Events",
  "Beauty",
  "Hotels",
] as const;

export const HOME_EXCLUDED_CATEGORY_NAMES = new Set(["fitness", "shopping"]);

export const HOME_COMING_SOON_CATEGORY_NAMES = new Set([
  "tourism",
  "entertainment",
  "events",
  "beauty",
  "hotels",
]);
