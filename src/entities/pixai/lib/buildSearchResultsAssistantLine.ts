import { i18n } from "@/shared/lib/i18n";
import { localizeCategoryName } from "@/entities/category";
import type { PixAIFlowPayload } from "../api/usePixAI";

export function buildSearchResultsAssistantLine(params: {
  count: number;
  requestType: string;
  scopeText: string;
}): string {
  return i18n.t("aiBooking.searchResultsLine", params);
}

/** Bookings need at least 2 stops to be worth stringing into a route. */
const MIN_PLACE_COUNT_FOR_ROUTE_NUDGE = 2;

export function buildSearchResultsLineFromFlow(flow: PixAIFlowPayload, placeCount: number): string {
  if (placeCount === 0) {
    return i18n.t("aiBooking.searchNoMatchingPlaces");
  }

  const requestType = flow.isRestaurantTable
    ? i18n.t("bookingCommon.restaurantTable")
    : flow.categoryName
      ? localizeCategoryName(flow.categoryName)
      : i18n.t("aiBooking.placesFallback");

  const scopeText =
    flow.mode === "nearby"
      ? i18n.t("bookingCommon.nearMe5Miles")
      : i18n.t("bookingCommon.allPlacesInMyCity");

  const line = buildSearchResultsAssistantLine({ count: placeCount, requestType, scopeText });
  if (placeCount < MIN_PLACE_COUNT_FOR_ROUTE_NUDGE) return line;
  return `${line}\n\n${i18n.t("aiBooking.searchResultsRouteNudge")}`;
}

/** Legacy English assistant lines stored before i18n (or from orchestrator fallback). */
const LEGACY_SEARCH_RESULTS_RE =
  /^I found (\d+) (services|restaurant tables) (near you|in (.+?))\. Pick one and I will suggest the best available slots\.$/;

export function resolveLegacySearchResultsLine(content: string): string | null {
  const match = content.match(LEGACY_SEARCH_RESULTS_RE);
  if (!match) return null;

  const count = Number(match[1]);
  const requestType =
    match[2] === "restaurant tables"
      ? i18n.t("bookingCommon.restaurantTable")
      : i18n.t("aiBooking.placesFallback");
  const scopeText =
    match[3] === "near you"
      ? i18n.t("bookingCommon.nearMe5Miles")
      : i18n.t("aiBooking.scopeInCity", { city: match[4]?.trim() || i18n.t("aiBooking.yourCity") });

  return buildSearchResultsAssistantLine({ count, requestType, scopeText });
}
