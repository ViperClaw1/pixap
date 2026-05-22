import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/api/queryKeys";
import type { Notification } from "../api/useNotifications";
import { listHasId } from "@/shared/realtime/dedupe";

export function applyNotificationCreated(
  queryClient: QueryClient,
  userId: string,
  row: Notification,
): void {
  queryClient.setQueryData<Notification[]>(queryKeys.notifications.list(userId), (prev) => {
    if (!prev || listHasId(prev, row.id)) return prev;
    return [row, ...prev];
  });

  if (!row.is_read) {
    queryClient.setQueryData<number>(queryKeys.notifications.unread(userId), (count) => (count ?? 0) + 1);
  }
}

export function applyNotificationRead(
  queryClient: QueryClient,
  userId: string,
  notificationId: string,
): void {
  let wasUnread = false;

  queryClient.setQueryData<Notification[]>(queryKeys.notifications.list(userId), (prev) => {
    if (!prev) return prev;
    return prev.map((n) => {
      if (n.id !== notificationId) return n;
      if (!n.is_read) wasUnread = true;
      return { ...n, is_read: true };
    });
  });

  if (wasUnread) {
    queryClient.setQueryData<number>(queryKeys.notifications.unread(userId), (count) =>
      Math.max(0, (count ?? 0) - 1),
    );
  }
}
