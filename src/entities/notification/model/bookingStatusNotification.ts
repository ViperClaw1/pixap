import type { TFunction } from "i18next";
import type { BookingDisplayStatus } from "@/entities/booking";

export type BookingStatusNotificationOptions = {
  venueDeclined?: boolean;
};

export function bookingStatusNotificationText(
  t: TFunction,
  venueName: string,
  status: BookingDisplayStatus,
  options?: BookingStatusNotificationOptions,
): string {
  if (status === "cancelled" && options?.venueDeclined) {
    return t("bookings.statusNotification.venueSlotUnavailable", { venueName });
  }

  switch (status) {
    case "confirmed":
      return t("bookings.statusNotification.confirmed", { venueName });
    case "cancelled":
      return t("bookings.statusNotification.cancelled", { venueName });
    case "completed":
      return t("bookings.statusNotification.completed", { venueName });
    case "payment awaiting":
      return t("bookings.statusNotification.paymentAwaiting", { venueName });
    case "draft":
    default:
      return t("bookings.statusNotification.draft", { venueName });
  }
}
