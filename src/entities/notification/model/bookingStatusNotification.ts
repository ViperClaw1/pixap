import type { BookingDisplayStatus } from "@/entities/booking";

export enum BookingStatusNotificationTemplate {
  Draft = "Your booking is in draft state.",
  Confirmed = "Your booking is confirmed.",
  Cancelled = "Your booking was cancelled.",
  Completed = "Your booking is completed.",
  PaymentAwaiting = "Your booking awaits payment.",
}

export function bookingStatusNotificationText(venueName: string, status: BookingDisplayStatus) {
  switch (status) {
    case "confirmed":
      return `${venueName}: ${BookingStatusNotificationTemplate.Confirmed}`;
    case "cancelled":
      return `${venueName}: ${BookingStatusNotificationTemplate.Cancelled}`;
    case "completed":
      return `${venueName}: ${BookingStatusNotificationTemplate.Completed}`;
    case "payment awaiting":
      return `${venueName}: ${BookingStatusNotificationTemplate.PaymentAwaiting}`;
    case "draft":
    default:
      return `${venueName}: ${BookingStatusNotificationTemplate.Draft}`;
  }
}
