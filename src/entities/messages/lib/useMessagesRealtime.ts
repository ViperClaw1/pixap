import { useEffect, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";

function invalidateInbox(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.messages.inboxPrefix });
}

function invalidateThread(queryClient: QueryClient, threadId: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.messages.threadPrefix(threadId) });
}

/** Inbox list: new messages + read-state changes across the user's threads. */
export function useMessagesInboxRealtime(userId: string | undefined | null) {
  const queryClient = useQueryClient();
  const [realtimeConnected, setRealtimeConnected] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`messages_inbox_${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        invalidateInbox(queryClient);
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_thread_participants",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          invalidateInbox(queryClient);
        },
      )
      .subscribe((status) => setRealtimeConnected(status === "SUBSCRIBED"));

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return realtimeConnected;
}

/** Open thread: messages, reactions, hide-for-me, peer read receipts. */
export function useMessageThreadRealtime(threadId: string | undefined | null, userId: string | undefined | null) {
  const queryClient = useQueryClient();
  const [realtimeConnected, setRealtimeConnected] = useState(true);

  useEffect(() => {
    if (!threadId || !userId) return;

    const onThreadMessageChange = () => {
      invalidateThread(queryClient, threadId);
      invalidateInbox(queryClient);
    };

    const channel = supabase
      .channel(`messages_thread_${threadId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` },
        onThreadMessageChange,
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, () => {
        invalidateThread(queryClient, threadId);
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_hidden_for_users",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          invalidateThread(queryClient, threadId);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_thread_participants",
          filter: `thread_id=eq.${threadId}`,
        },
        onThreadMessageChange,
      )
      .subscribe((status) => setRealtimeConnected(status === "SUBSCRIBED"));

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [threadId, userId, queryClient]);

  return realtimeConnected;
}
