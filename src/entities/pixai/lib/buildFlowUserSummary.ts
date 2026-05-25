import { i18n } from "@/shared/lib/i18n";
import { localizeCategoryName } from "@/entities/category";
import type { PixAIFlowPayload } from "@/entities/pixai";

export function buildFlowUserSummary(flow: PixAIFlowPayload): string {
  const category = flow.isRestaurantTable
    ? i18n.t("bookingCommon.restaurantTable")
    : flow.categoryName
      ? localizeCategoryName(flow.categoryName)
      : i18n.t("bookingCommon.service");
  const scope =
    flow.mode === "nearby" ? i18n.t("bookingCommon.nearMe5Miles") : i18n.t("bookingCommon.allPlacesInCity");
  let summary = i18n.t("aiBooking.flowFindSummary", { city: flow.city, category, scope });
  if (flow.comment?.trim()) {
    summary += ` | ${i18n.t("aiBooking.flowFindComment", { text: flow.comment.trim() })}`;
  }
  return summary;
}
