import type { BusinessCard } from "@/entities/business-card";

export type SearchQuickFilterId = "all" | "restaurants" | "bars" | "clubs";

export const SEARCH_QUICK_FILTERS: Array<{
  id: SearchQuickFilterId;
  emoji?: string;
  labelKey: string;
  defaultLabel: string;
}> = [
  { id: "all", labelKey: "search.filters.all", defaultLabel: "All" },
  { id: "restaurants", emoji: "🍽", labelKey: "search.filters.restaurants", defaultLabel: "Restaurants" },
  { id: "bars", emoji: "🍸", labelKey: "search.filters.bars", defaultLabel: "Bars" },
  { id: "clubs", emoji: "🎵", labelKey: "search.filters.clubs", defaultLabel: "Clubs" },
];

// Hidden until venue opening hours are available:
// { id: "open_now", emoji: "🌙", labelKey: "search.filters.openNow", defaultLabel: "Open now" },

function haystack(place: BusinessCard): string {
  const category = place.category?.name?.toLowerCase() ?? "";
  const tags = place.tags.join(" ").toLowerCase();
  return `${category} ${tags}`;
}

function matchesAny(place: BusinessCard, needles: string[]): boolean {
  const text = haystack(place);
  return needles.some((needle) => text.includes(needle));
}

export function matchesSearchQuickFilter(place: BusinessCard, filter: SearchQuickFilterId): boolean {
  switch (filter) {
    case "all":
      return true;
    case "restaurants":
      return matchesAny(place, ["restaurant", "food", "dining", "cafe", "bistro"]);
    case "bars":
      return matchesAny(place, ["bar", "pub", "lounge", "cocktail"]);
    case "clubs":
      return matchesAny(place, ["club", "nightlife", "disco", "dance"]);
    default:
      return true;
  }
}

export function applySearchQuickFilters(
  places: BusinessCard[],
  activeFilter: SearchQuickFilterId,
): BusinessCard[] {
  if (activeFilter === "all") return places;
  return places.filter((place) => matchesSearchQuickFilter(place, activeFilter));
}
