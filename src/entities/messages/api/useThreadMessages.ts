import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import { queryKeys } from "@/shared/api/queryKeys";
import type { MessageParticipantProfile } from "@/shared/model/types/messages";
import { resolvePeerLastSeenAt } from "@/entities/messages/lib/peerPresence";
import { fetchThreadMessagesPage } from "@/entities/messages/lib/fetchThreadMessagesPage";
import { prependOlderMessages, type ThreadMessagesCache } from "@/entities/messages/lib/messageCachePatch";
import { useMessageThreadRealtime } from "@/entities/messages/lib/useMessagesRealtime";
import { REALTIME_POLL_MS } from "@/shared/realtime/realtimePolling";

export type MessageBubble = {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  attachments: string[];
  created_at: string;
  mine: boolean;
  sender_profile: MessageParticipantProfile | null;
  reactions: Array<{ reaction: string; count: number; mine: boolean }>;
};

export function useThreadMessages(threadId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const realtimeConnected = useMessageThreadRealtime(threadId, userId);

  const query = useQuery({
    queryKey: queryKeys.messages.thread(threadId, userId),
    queryFn: async (): Promise<ThreadMessagesCache> => {
      if (!threadId || !userId) {
        return {
          messages: [],
          participants: [],
          lastReadAtByUserId: {},
          lastSeenAtByUserId: {},
          hasMoreOlder: false,
          oldestLoadedAt: null,
        };
      }
      const page = await fetchThreadMessagesPage({ threadId, userId });
      return {
        messages: page.messages,
        participants: page.participants,
        lastReadAtByUserId: page.lastReadAtByUserId,
        lastSeenAtByUserId: page.lastSeenAtByUserId,
        hasMoreOlder: page.hasMoreOlder,
        oldestLoadedAt: page.oldestLoadedAt,
      };
    },
    enabled: !!threadId && !!userId,
    staleTime: 15 * 1000,
    refetchInterval: realtimeConnected ? false : REALTIME_POLL_MS.messagesThread,
  });

  const loadOlderMessages = useCallback(async () => {
    if (!threadId || !userId || !query.data?.hasMoreOlder || !query.data.oldestLoadedAt || isLoadingOlder) return;
    setIsLoadingOlder(true);
    try {
      const page = await fetchThreadMessagesPage({
        threadId,
        userId,
        beforeCreatedAt: query.data.oldestLoadedAt,
      });
      prependOlderMessages(queryClient, threadId, userId, page.messages, page.hasMoreOlder, page.oldestLoadedAt);
    } finally {
      setIsLoadingOlder(false);
    }
  }, [isLoadingOlder, query.data?.hasMoreOlder, query.data?.oldestLoadedAt, queryClient, threadId, userId]);

  const peer = useMemo(() => {
    if (!userId) return null;
    return (query.data?.participants ?? []).find((participant) => participant.id !== userId) ?? null;
  }, [query.data?.participants, userId]);

  const peerLastReadAt = useMemo(() => {
    if (!peer?.id) return null;
    return query.data?.lastReadAtByUserId?.[peer.id] ?? null;
  }, [peer?.id, query.data?.lastReadAtByUserId]);

  const peerLastSeenAt = useMemo(() => {
    if (!peer?.id) return null;
    return resolvePeerLastSeenAt({
      profileLastSeenAt: query.data?.lastSeenAtByUserId?.[peer.id] ?? null,
      threadLastReadAt: peerLastReadAt,
    });
  }, [peer?.id, peerLastReadAt, query.data?.lastSeenAtByUserId]);

  return {
    ...query,
    messages: query.data?.messages ?? [],
    participants: query.data?.participants ?? [],
    hasMoreOlder: query.data?.hasMoreOlder ?? false,
    loadOlderMessages,
    isLoadingOlder,
    peer,
    peerLastReadAt,
    peerLastSeenAt,
  };
}
