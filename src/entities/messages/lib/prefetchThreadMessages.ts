import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/api/queryKeys";
import { fetchThreadMessagesPage } from "./fetchThreadMessagesPage";

export function prefetchThreadMessages(
  queryClient: QueryClient,
  threadId: string,
  userId: string,
  viewerIsSupportStaff = false,
) {
  return queryClient.prefetchQuery({
    queryKey: queryKeys.messages.thread(threadId, userId),
    queryFn: async () => {
      const page = await fetchThreadMessagesPage({ threadId, userId, viewerIsSupportStaff });
      return {
        messages: page.messages,
        participants: page.participants,
        lastReadAtByUserId: page.lastReadAtByUserId,
        lastSeenAtByUserId: page.lastSeenAtByUserId,
        hasMoreOlder: page.hasMoreOlder,
        oldestLoadedAt: page.oldestLoadedAt,
        threadMeta: page.threadMeta,
        viewerIsSupportStaff,
      };
    },
    staleTime: 15_000,
  });
}
