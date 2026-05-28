import type { BookingDisplayStatus } from "../api/useBookings";

const snapshotsByUserId = new Map<string, Map<string, BookingDisplayStatus>>();
const hydratedUserIds = new Set<string>();
const suppressedBookingIdsByUser = new Map<string, Set<string>>();
const suppressedCartItemIdsByUser = new Map<string, Set<string>>();

function bookingSuppressSet(userId: string, store: Map<string, Set<string>>): Set<string> {
  let set = store.get(userId);
  if (!set) {
    set = new Set();
    store.set(userId, set);
  }
  return set;
}

export function getBookingStatusSnapshot(userId: string): Map<string, BookingDisplayStatus> {
  return new Map(snapshotsByUserId.get(userId) ?? []);
}

export function setBookingStatusSnapshot(userId: string, snapshot: Map<string, BookingDisplayStatus>): void {
  snapshotsByUserId.set(userId, snapshot);
}

export function hasHydratedBookingStatuses(userId: string): boolean {
  return hydratedUserIds.has(userId);
}

export function markBookingStatusesHydrated(userId: string): void {
  hydratedUserIds.add(userId);
}

export function suppressBookingStatusNotification(userId: string, bookingId: string): void {
  bookingSuppressSet(userId, suppressedBookingIdsByUser).add(bookingId);
}

export function suppressBookingStatusNotificationForCartItem(userId: string, cartItemId: string): void {
  bookingSuppressSet(userId, suppressedCartItemIdsByUser).add(cartItemId);
}

export function isBookingStatusNotificationSuppressed(
  userId: string,
  bookingId: string,
  linkedCartItemId?: string | null,
): boolean {
  if (bookingSuppressSet(userId, suppressedBookingIdsByUser).has(bookingId)) {
    return true;
  }
  if (linkedCartItemId && bookingSuppressSet(userId, suppressedCartItemIdsByUser).has(linkedCartItemId)) {
    return true;
  }
  return false;
}

export function clearBookingStatusTrackerForUser(userId: string): void {
  snapshotsByUserId.delete(userId);
  hydratedUserIds.delete(userId);
  suppressedBookingIdsByUser.delete(userId);
  suppressedCartItemIdsByUser.delete(userId);
}

export function clearAllBookingStatusTrackers(): void {
  snapshotsByUserId.clear();
  hydratedUserIds.clear();
  suppressedBookingIdsByUser.clear();
  suppressedCartItemIdsByUser.clear();
}
