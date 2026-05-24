import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import { queryKeys } from "@/shared/api/queryKeys";
import { invalidateMessagesInbox } from "@/entities/messages/lib/ensureDirectThread";
import { openOrCreateDirectThread } from "@/entities/messages/lib/openOrCreateDirectThread";

export function useOpenOrCreateThread() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (peerUserId: string) => {
      if (!user?.id) throw new Error("Authentication required");
      return openOrCreateDirectThread(peerUserId, user.id);
    },
    onSuccess: (result, peerUserId) => {
      if (!user?.id) return;
      queryClient.setQueryData(queryKeys.messages.directThread(user.id, peerUserId), result);
      void invalidateMessagesInbox(queryClient);
    },
  });
}
