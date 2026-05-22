import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/api/queryKeys";
import type { MessageThreadItem } from "@/shared/model/types/messages";
import type { MessageBubble } from "../api/useThreadMessages";

export type ThreadMessagesCache = {
  messages: MessageBubble[];
  participants: Array<{ id: string; first_name: string | null; last_name: string | null; avatar_url: string | null; username: string | null }>;
  lastReadAtByUserId: Record<string, string | null>;
  lastSeenAtByUserId: Record<string, string | null>;
  hasMoreOlder: boolean;
  oldestLoadedAt: string | null;
};

export function getThreadMessagesCache(
  queryClient: QueryClient,
  threadId: string,
  userId: string | null,
): ThreadMessagesCache | undefined {
  return queryClient.getQueryData<ThreadMessagesCache>(queryKeys.messages.thread(threadId, userId));
}

export function setThreadMessagesCache(
  queryClient: QueryClient,
  threadId: string,
  userId: string | null,
  updater: (prev: ThreadMessagesCache | undefined) => ThreadMessagesCache | undefined,
) {
  queryClient.setQueryData<ThreadMessagesCache>(queryKeys.messages.thread(threadId, userId), updater);
}

export function patchThreadLastRead(
  queryClient: QueryClient,
  threadId: string,
  userId: string,
  readerUserId: string,
  lastReadAt: string,
) {
  setThreadMessagesCache(queryClient, threadId, userId, (prev) => {
    if (!prev) return prev;
    return {
      ...prev,
      lastReadAtByUserId: {
        ...prev.lastReadAtByUserId,
        [readerUserId]: lastReadAt,
      },
    };
  });
}

export function appendThreadMessage(
  queryClient: QueryClient,
  threadId: string,
  userId: string | null,
  message: MessageBubble,
) {
  setThreadMessagesCache(queryClient, threadId, userId, (prev) => {
    if (!prev) return prev;
    if (prev.messages.some((m) => m.id === message.id)) return prev;
    let messages = prev.messages;
    if (message.mine) {
      messages = messages.filter((m) => !isOptimisticMessageId(m.id));
    }
    return {
      ...prev,
      messages: [...messages, message],
    };
  });
}

export function removeThreadMessage(
  queryClient: QueryClient,
  threadId: string,
  userId: string | null,
  messageId: string,
) {
  setThreadMessagesCache(queryClient, threadId, userId, (prev) => {
    if (!prev) return prev;
    return {
      ...prev,
      messages: prev.messages.filter((m) => m.id !== messageId),
    };
  });
}

export function isOptimisticMessageId(messageId: string): boolean {
  return messageId.startsWith("optimistic-");
}

/** Swap optimistic placeholder for the persisted row (avoids send flicker). */
export function replaceOptimisticThreadMessage(
  queryClient: QueryClient,
  threadId: string,
  userId: string | null,
  optimisticId: string,
  message: MessageBubble,
) {
  setThreadMessagesCache(queryClient, threadId, userId, (prev) => {
    if (!prev) return prev;
    let replaced = false;
    const messages = prev.messages
      .map((m) => {
        if (m.id === optimisticId) {
          replaced = true;
          return message;
        }
        return m;
      })
      .filter((m) => !isOptimisticMessageId(m.id) || m.id === message.id);
    if (!replaced && !messages.some((m) => m.id === message.id)) {
      return { ...prev, messages: [...messages, message] };
    }
    return { ...prev, messages };
  });
}

export function prependOlderMessages(
  queryClient: QueryClient,
  threadId: string,
  userId: string | null,
  older: MessageBubble[],
  hasMoreOlder: boolean,
  oldestLoadedAt: string | null,
) {
  setThreadMessagesCache(queryClient, threadId, userId, (prev) => {
    if (!prev) return prev;
    const existingIds = new Set(prev.messages.map((m) => m.id));
    const uniqueOlder = older.filter((m) => !existingIds.has(m.id));
    if (!uniqueOlder.length && prev.hasMoreOlder === hasMoreOlder) return prev;
    return {
      ...prev,
      messages: [...uniqueOlder, ...prev.messages],
      hasMoreOlder,
      oldestLoadedAt: oldestLoadedAt ?? prev.oldestLoadedAt,
    };
  });
}

/** Updates unread badge in inbox cache without refetching the full list. */
export function patchInboxThreadUnread(
  queryClient: QueryClient,
  userId: string | null,
  threadId: string,
  unreadCount: number,
) {
  if (!userId) return;
  queryClient.setQueryData<MessageThreadItem[]>(queryKeys.messages.inbox(userId), (prev) => {
    if (!prev?.length) return prev;
    let changed = false;
    const next = prev.map((thread) => {
      if (thread.thread_id !== threadId) return thread;
      if (thread.unread_count === unreadCount) return thread;
      changed = true;
      return { ...thread, unread_count: unreadCount };
    });
    return changed ? next : prev;
  });
}

export function threadCacheHasMessageId(
  queryClient: QueryClient,
  threadId: string,
  userId: string | null,
  messageId: string,
): boolean {
  const cache = getThreadMessagesCache(queryClient, threadId, userId);
  return cache?.messages.some((m) => m.id === messageId) ?? false;
}
