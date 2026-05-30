import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import { queryKeys } from "@/shared/api/queryKeys";
import { updateAdminContentReportStatus } from "./adminModerationApi";
import type { ContentReportStatus } from "../types/contentReport";

export function useUpdateContentReportStatus() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({
      reportId,
      status,
    }: {
      reportId: string;
      status: Exclude<ContentReportStatus, "pending">;
    }) => updateAdminContentReportStatus(reportId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminModeration.prefix });
      if (user?.id) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.adminModeration.pendingCount(user.id),
        });
      }
    },
  });
}
