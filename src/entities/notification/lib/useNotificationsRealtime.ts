import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { useRealtimeChannel } from "@/shared/realtime/useRealtimeChannel";
import { realtimeEventBus } from "@/shared/realtime/eventBus";
import type { NotificationRow } from "@/shared/realtime/events";
import type { Notification } from "../api/useNotifications";
import { applyNotificationCreated, applyNotificationRead } from "./notificationCachePatch";

function parseNotificationRow(payload: {
  new?: Partial<NotificationRow>;
  old?: Partial<NotificationRow>;
}): Notification | null {
  const row = payload.new ?? payload.old;
  if (!row?.id || !row.user_id || !row.text) return null;
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    text: String(row.text),
    business_card_id: (row.business_card_id as string | null) ?? null,
    is_read: Boolean(row.is_read),
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

/** In-app notifications list + unread badge via postgres_changes. */
export function useNotificationsRealtime(userId: string | undefined | null): boolean {
  const queryClient = useQueryClient();

  const createChannel = useCallback(() => {
    const uid = userId!;
    return supabase
      .channel(`notifications_${uid}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${uid}`,
        },
        (payload) => {
          const notification = parseNotificationRow(
            payload as { new?: Partial<NotificationRow>; old?: Partial<NotificationRow> },
          );
          if (!notification) return;
          applyNotificationCreated(queryClient, uid, notification);
          realtimeEventBus.emit({ type: "notification.created", notification });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${uid}`,
        },
        (payload) => {
          const row = parseNotificationRow(
            payload as { new?: Partial<NotificationRow>; old?: Partial<NotificationRow> },
          );
          if (!row?.is_read) return;
          applyNotificationRead(queryClient, uid, row.id);
          realtimeEventBus.emit({ type: "notification.read", notificationId: row.id, isRead: true });
        },
      );
  }, [userId, queryClient]);

  return useRealtimeChannel(userId ? `notifications_${userId}` : null, userId ? createChannel : null, {
    scope: "notifications",
  });
}
