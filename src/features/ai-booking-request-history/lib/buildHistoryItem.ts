import { i18n } from "@/shared/lib/i18n";
import type { BookingSearchSnapshot } from "@/features/ai-booking-chat/model/types";
import { localizeCategoryName } from "@/entities/category";
import type { CategoryIconSpec } from "@/entities/category";
import { resolveCategoryIconSpec } from "@/entities/category";
import { tintForTagKey } from "@/shared/lib/tagTint";

const RESTAURANT_TABLE_KEY = "restaurant-table";

export type BookingRequestHistoryItem = {
  tabId: string;
  title: string;
  subtitle: string;
  iconSpec: CategoryIconSpec;
  iconTint: string;
  isRestaurantTable: boolean;
};

export function buildHistoryTitleFromSnapshot(snapshot: BookingSearchSnapshot): string {
  const categoryLabel = snapshot.isRestaurantTable
    ? i18n.t("bookingCommon.restaurantTable")
    : localizeCategoryName(snapshot.categoryName);
  const city = snapshot.city.trim();
  if (!city) return categoryLabel;
  const comma = city.indexOf(",");
  const shortCity = comma > 0 ? city.slice(0, comma).trim() : city;
  return `${categoryLabel} · ${shortCity}`;
}

function formatRelativeDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    date.getFullYear() === tomorrow.getFullYear() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getDate() === tomorrow.getDate();

  const time = date.toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" });
  if (sameDay) {
    return i18n.t("aiBooking.historyTodayAt", { time });
  }
  if (isTomorrow) {
    return i18n.t("aiBooking.historyTomorrowAt", { time });
  }
  const datePart = date.toLocaleDateString(i18n.language, { day: "numeric", month: "short" });
  return `${datePart}, ${time}`;
}

export function buildHistoryItemFromTab(input: {
  tabId: string;
  title: string;
  createdAt: number;
  searchSnapshot?: BookingSearchSnapshot | null;
}): BookingRequestHistoryItem | null {
  const snap = input.searchSnapshot;
  if (!snap) return null;

  const categoryId = snap.isRestaurantTable ? RESTAURANT_TABLE_KEY : snap.categoryId;
  const iconSpec = snap.isRestaurantTable
    ? ({ family: "ionicons", name: "restaurant-outline" } as const)
    : resolveCategoryIconSpec(snap.categoryName);

  const searchedAt = snap.searchedAt ?? input.createdAt;
  const persons = snap.persons ?? 2;
  const subtitle = `${formatRelativeDateTime(searchedAt)} • ${i18n.t("bookings.persons", { count: persons })}`;

  return {
    tabId: input.tabId,
    title: input.title.trim() || buildHistoryTitleFromSnapshot(snap),
    subtitle,
    iconSpec,
    iconTint: tintForTagKey(categoryId || snap.categoryName),
    isRestaurantTable: snap.isRestaurantTable,
  };
}
