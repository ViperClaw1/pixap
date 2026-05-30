import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import { queryKeys } from "@/shared/api/queryKeys";
import { canAccessAdminDashboard } from "@/entities/admin-analytics";
import { useProfile } from "@/entities/user";
import { fetchAdminContentReports } from "./adminModerationApi";
import type { AdminReportStatusFilter } from "../types/contentReport";

export function useAdminContentReports(
  statusFilter: AdminReportStatusFilter,
  options?: { enabled?: boolean },
) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const canAccess = canAccessAdminDashboard(profile?.account_role);

  return useQuery({
    queryKey: queryKeys.adminModeration.list(statusFilter, user?.id ?? null),
    queryFn: () => fetchAdminContentReports(statusFilter),
    enabled: !!user && canAccess && (options?.enabled ?? true),
    staleTime: 30_000,
  });
}

export function useAdminModerationPendingCount(options?: { enabled?: boolean }) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const canAccess = canAccessAdminDashboard(profile?.account_role);

  return useQuery({
    queryKey: queryKeys.adminModeration.pendingCount(user?.id ?? null),
    queryFn: async () => {
      const page = await fetchAdminContentReports("pending", 1, 0);
      return page.pending_count;
    },
    enabled: !!user && canAccess && (options?.enabled ?? true),
    staleTime: 60_000,
  });
}
