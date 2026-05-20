import { useEffect, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { recordMessagingInvalidate } from "@/shared/lib/messagingPerf";
import {
  appendThreadMessage,
  patchThreadLastRead,
  removeThreadMessage,
  threadCacheHasMessageId,
} from "./messageCachePatch";
import { debouncedInboxInvalidate, debouncedThreadInvalidate } from "./messageRealtimeDebounce";
import { parseRealtimeRow, rowToMessageBubble } from "./hydrateRealtimeMessage";

function invalidateInbox(queryClient: QueryClient) {
  recordMessagingInvalidate("inbox");
  void queryClient.invalidateQueries({ queryKey: queryKeys.messages.inboxPrefix });
}

function invalidateThread(queryClient: QueryClient, threadId: string) {
  recordMessagingInvalidate("thread");
  void queryClient.invalidateQueries({ queryKey: queryKeys.messages.threadPrefix(threadId) });
}

function scheduleInboxInvalidate(queryClient: QueryClient, userId: string) {
  debouncedInboxInvalidate(userId, () => invalidateInbox(queryClient));
}

function scheduleThreadInvalidate(queryClient: QueryClient, threadId: string) {
  debouncedThreadInvalidate(threadId, () => invalidateThread(queryClient, threadId));
}

type MessagePayload = {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  attachments: string[] | null;
  created_at: string;
};

type ParticipantPayload = {
  thread_id: string;
  user_id: string;
  last_read_message_at: string | null;
};

type ReactionPayload = {
  message_id: string;
  user_id: string;
  reaction: string;
};

/** Inbox list: new messages + read-state changes across the user's threads. */
export function useMessagesInboxRealtime(userId: string | undefined | null) {
  const queryClient = useQueryClient();
  const [realtimeConnected, setRealtimeConnected] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`messages_inbox_${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        scheduleInboxInvalidate(queryClient, userId);
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
          scheduleInboxInvalidate(queryClient, userId);
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
      scheduleThreadInvalidate(queryClient, threadId);
      scheduleInboxInvalidate(queryClient, userId);
    };

    const channel = supabase
      .channel(`messages_thread_${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` },
        (payload) => {
          const row = parseRealtimeRow<MessagePayload>(payload as { new?: MessagePayload; old?: MessagePayload });
          if (!row || row.thread_id !== threadId) return;
          if (threadCacheHasMessageId(queryClient, threadId, userId, row.id)) return;
          appendThreadMessage(queryClient, threadId, userId, rowToMessageBubble(row, userId));
          scheduleInboxInvalidate(queryClient, userId);
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` },
        (payload) => {
          const row = parseRealtimeRow<MessagePayload>(payload as { new?: MessagePayload; old?: MessagePayload });
          if (!row?.id) {
            onThreadMessageChange();
            return;
          }
          removeThreadMessage(queryClient, threadId, userId, row.id);
          scheduleInboxInvalidate(queryClient, userId);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` },
        () => onThreadMessageChange(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        (payload) => {
          const row = parseRealtimeRow<ReactionPayload>(payload as { new?: ReactionPayload; old?: ReactionPayload });
          if (!row?.message_id) {
            onThreadMessageChange();
            return;
          }
          if (!threadCacheHasMessageId(queryClient, threadId, userId, row.message_id)) return;
          onThreadMessageChange();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_hidden_for_users",
          filter: `user_id=eq.${userId}`,
        },
        () => onThreadMessageChange(),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "message_thread_participants",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const row = parseRealtimeRow<ParticipantPayload>(payload as { new?: ParticipantPayload; old?: ParticipantPayload });
          if (!row?.user_id || !row.last_read_message_at) return;
          patchThreadLastRead(queryClient, threadId, userId, row.user_id, row.last_read_message_at);
          // Read receipts only affect thread UI; inbox list does not need refetch.
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_thread_participants",
          filter: `thread_id=eq.${threadId}`,
        },
        () => onThreadMessageChange(),
      )
      .subscribe((status) => setRealtimeConnected(status === "SUBSCRIBED"));

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [threadId, userId, queryClient]);

  return realtimeConnected;
}
