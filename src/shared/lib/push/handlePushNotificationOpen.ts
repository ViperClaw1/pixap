import * as Linking from "expo-linking";
import { rootNavigationRef } from "@/app/navigation/rootNavigationRef";

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function parsePlaceIdFromPushUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const parsed = Linking.parse(trimmed);
    const path = parsed.path?.replace(/^\//, "") ?? "";
    if (path.startsWith("place/")) {
      const raw = path.slice("place/".length).split("/")[0] ?? "";
      const id = decodeURIComponent(raw).trim();
      return id || null;
    }
  } catch {
    // fall through to regex
  }

  const match = trimmed.match(/(?:^|[/:])place\/([^/?#]+)/i);
  if (!match?.[1]) return null;
  return decodeURIComponent(match[1]).trim() || null;
}

function parseBookingIdFromPushUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const parsed = Linking.parse(trimmed);
    const path = parsed.path?.replace(/^\//, "") ?? "";
    if (path.startsWith("bookings/")) {
      const raw = path.slice("bookings/".length).split("/")[0] ?? "";
      const id = decodeURIComponent(raw).trim();
      return id || null;
    }
  } catch {
    // fall through to regex
  }

  const match = trimmed.match(/(?:^|[/:])bookings\/([^/?#]+)/i);
  if (!match?.[1]) return null;
  return decodeURIComponent(match[1]).trim() || null;
}

function resolveDailyRecommendationVenueId(data: Record<string, unknown>): string | null {
  return (
    readNonEmptyString(data.top_venue_id) ??
    readNonEmptyString(data.venue_id) ??
    (readNonEmptyString(data.url) ? parsePlaceIdFromPushUrl(readNonEmptyString(data.url)!) : null)
  );
}

function resolveBookingId(data: Record<string, unknown>): string | null {
  return (
    readNonEmptyString(data.booking_id) ??
    (readNonEmptyString(data.url) ? parseBookingIdFromPushUrl(readNonEmptyString(data.url)!) : null)
  );
}

function openBookingDetail(bookingId: string): void {
  rootNavigationRef.navigate("Bookings", {
    screen: "BookingDetail",
    params: { bookingId },
  });
}

export function handlePushNotificationOpen(data: Record<string, unknown>): void {
  if (!rootNavigationRef.isReady()) return;

  const bookingKind = data.kind;
  if (bookingKind === "booking_reminder" || bookingKind === "booking_status") {
    const bookingId = resolveBookingId(data);
    if (bookingId) {
      openBookingDetail(bookingId);
    }
    return;
  }

  if (data.kind !== "daily_recommendation") return;

  const venueId = resolveDailyRecommendationVenueId(data);
  if (venueId) {
    rootNavigationRef.navigate("Home", {
      screen: "PlaceDetail",
      params: { id: venueId },
    });
    return;
  }

  const date = readNonEmptyString(data.date) ?? undefined;
  rootNavigationRef.navigate("Home", {
    screen: "DailyRecommendations",
    params: { date },
  });
}
