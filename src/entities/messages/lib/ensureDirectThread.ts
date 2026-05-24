import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/api/queryKeys";
import { openOrCreateDirectThread, type OpenOrCreateDirectThreadResult } from "./openOrCreateDirectThread";

export function directThreadQueryOptions(userId: string, peerUserId: string) {
  return {
    queryKey: queryKeys.messages.directThread(userId, peerUserId),
    queryFn: (): Promise<OpenOrCreateDirectThreadResult> => openOrCreateDirectThread(peerUserId, userId),
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
  };
}

export function prefetchDirectThread(queryClient: QueryClient, peerUserId: string, userId: string | null | undefined) {
  if (!userId || !peerUserId) return Promise.resolve();
  return queryClient.prefetchQuery(directThreadQueryOptions(userId, peerUserId));
}

export function invalidateMessagesInbox(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.messages.inboxPrefix });
}
