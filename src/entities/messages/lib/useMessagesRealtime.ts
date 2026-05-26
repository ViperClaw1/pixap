import { useCallback } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { recordMessagingInvalidate } from "@/shared/lib/messagingPerf";
import { useRealtimeChannel } from "@/shared/realtime/useRealtimeChannel";
import {
  appendThreadMessage,
  patchThreadLastRead,
  removeThreadMessage,
  threadCacheHasMessageId,
} from "./messageCachePatch";
import { debouncedInboxInvalidate, debouncedThreadInvalidate } from "./messageRealtimeDebounce";
import { getThreadMessagesCache } from "./messageCachePatch";
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
  attachment_blurhashes?: unknown;
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

/** Inbox list: scoped fan-out events for the signed-in user (see message_inbox_events). */
export function useMessagesInboxRealtime(userId: string | undefined | null) {
  const queryClient = useQueryClient();

  const createChannel = useCallback(() => {
    const uid = userId!;
    return supabase
      .channel(`messages_inbox_${uid}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_inbox_events",
          filter: `user_id=eq.${uid}`,
        },
        () => {
          scheduleInboxInvalidate(queryClient, uid);
        },
      );
  }, [userId, queryClient]);

  return useRealtimeChannel(userId ? `messages_inbox_${userId}` : null, userId ? createChannel : null, {
    scope: "messages_inbox",
  });
}

/** Open thread: messages, reactions, hide-for-me, peer read receipts. */
export function useMessageThreadRealtime(threadId: string | undefined | null, userId: string | undefined | null) {
  const queryClient = useQueryClient();

  const createChannel = useCallback(() => {
    const tid = threadId!;
    const uid = userId!;

    const onThreadMessageChange = () => {
      scheduleThreadInvalidate(queryClient, tid);
      scheduleInboxInvalidate(queryClient, uid);
    };

    return supabase
      .channel(`messages_thread_${tid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${tid}` },
        (payload) => {
          const row = parseRealtimeRow<MessagePayload>(
            payload as unknown as { new?: MessagePayload; old?: MessagePayload },
          );
          if (!row || row.thread_id !== tid) return;
          if (threadCacheHasMessageId(queryClient, tid, uid, row.id)) return;
          const cache = getThreadMessagesCache(queryClient, tid, uid);
          appendThreadMessage(
            queryClient,
            tid,
            uid,
            rowToMessageBubble(row, uid, cache?.threadMeta ?? null, cache?.viewerIsSupportStaff ?? false),
          );
          scheduleInboxInvalidate(queryClient, uid);
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages", filter: `thread_id=eq.${tid}` },
        (payload) => {
          const row = parseRealtimeRow<MessagePayload>(
            payload as unknown as { new?: MessagePayload; old?: MessagePayload },
          );
          if (!row?.id) {
            onThreadMessageChange();
            return;
          }
          removeThreadMessage(queryClient, tid, uid, row.id);
          scheduleInboxInvalidate(queryClient, uid);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `thread_id=eq.${tid}` },
        () => onThreadMessageChange(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        (payload) => {
          const row = parseRealtimeRow<ReactionPayload>(
            payload as unknown as { new?: ReactionPayload; old?: ReactionPayload },
          );
          if (!row?.message_id) {
            onThreadMessageChange();
            return;
          }
          if (!threadCacheHasMessageId(queryClient, tid, uid, row.message_id)) return;
          onThreadMessageChange();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_hidden_for_users",
          filter: `user_id=eq.${uid}`,
        },
        () => onThreadMessageChange(),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "message_thread_participants",
          filter: `thread_id=eq.${tid}`,
        },
        (payload) => {
          const row = parseRealtimeRow<ParticipantPayload>(
            payload as unknown as { new?: ParticipantPayload; old?: ParticipantPayload },
          );
          if (!row?.user_id || !row.last_read_message_at) return;
          patchThreadLastRead(queryClient, tid, uid, row.user_id, row.last_read_message_at);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_thread_participants",
          filter: `thread_id=eq.${tid}`,
        },
        () => onThreadMessageChange(),
      );
  }, [threadId, userId, queryClient]);

  return useRealtimeChannel(
    threadId && userId ? `messages_thread_${threadId}` : null,
    threadId && userId ? createChannel : null,
    { scope: "messages_thread" },
  );
}
