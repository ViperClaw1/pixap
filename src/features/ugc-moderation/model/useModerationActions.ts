import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import { queryKeys } from "@/shared/api/queryKeys";
import { blockUser, fetchBlockedUserIds, reportContent, unblockUser } from "../api/moderationApi";
import type { ReportContentPayload } from "../types/moderation";

export function useBlockedUserIds(options?: { enabled?: boolean }) {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.moderation.blocked(user?.id),
    queryFn: () => fetchBlockedUserIds(user!.id),
    enabled: !!user && (options?.enabled ?? true),
    staleTime: 60_000,
  });
}

export function useReportContent() {
  return useMutation({
    mutationFn: (payload: ReportContentPayload) => reportContent(payload),
  });
}

export function useBlockUser() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (blockedId: string) => blockUser(blockedId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.moderation.root });
      void queryClient.invalidateQueries({ queryKey: queryKeys.posts.feedPrefix });
      void queryClient.invalidateQueries({ queryKey: queryKeys.stories.feedPrefix });
      void queryClient.invalidateQueries({ queryKey: queryKeys.messages.inboxPrefix });
      void queryClient.invalidateQueries({ queryKey: queryKeys.publicProfiles.root });
      if (user?.id) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.moderation.blocked(user.id) });
      }
    },
  });
}

export function useUnblockUser() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (blockedId: string) => unblockUser(blockedId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.moderation.root });
      if (user?.id) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.moderation.blocked(user.id) });
      }
    },
  });
}
