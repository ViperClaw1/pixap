import type { Category } from "../api/useCategories";

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

export type HomeCategoryListItem = Category & {
  isComingSoon: boolean;
};

function normalizeCategoryName(name: string): string {
  return name.trim().toLowerCase();
}

export function isHomeComingSoonCategory(name: string): boolean {
  return HOME_COMING_SOON_CATEGORY_NAMES.has(normalizeCategoryName(name));
}

export function buildHomeCategoryList(categories: Category[]): HomeCategoryListItem[] {
  const byName = new Map<string, Category>();
  for (const category of categories) {
    const key = normalizeCategoryName(category.name);
    if (HOME_EXCLUDED_CATEGORY_NAMES.has(key)) continue;
    const prev = byName.get(key);
    if (!prev || category.business_cards_count > prev.business_cards_count) {
      byName.set(key, category);
    }
  }

  return HOME_CATEGORY_ORDER.map((displayName) => {
    const key = normalizeCategoryName(displayName);
    const existing = byName.get(key);
    const isComingSoon = isHomeComingSoonCategory(displayName);
    if (existing) {
      return { ...existing, isComingSoon };
    }
    return {
      id: `home-category-${key}`,
      name: displayName,
      business_cards_count: 0,
      isComingSoon,
    };
  });
}

export function isRestaurantCategoryName(name: string): boolean {
  return normalizeCategoryName(name) === "restaurants";
}

export function isHomeCategorySelectable(item: HomeCategoryListItem): boolean {
  return !item.isComingSoon && !item.id.startsWith("home-category-");
}
