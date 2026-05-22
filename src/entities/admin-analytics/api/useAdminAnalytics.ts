import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/app/providers/AuthProvider";
import { useProfile } from "@/entities/user";
import { canAccessAdminDashboard } from "../lib/canAccessAdminDashboard";
import type { AnalyticsPeriod } from "../model/types";
import { getAdminAnalyticsProvider } from "./getAdminAnalyticsProvider";

const STALE_MS = 3 * 60 * 1000;

export function useAdminAnalytics(period: AnalyticsPeriod) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const canAccess = canAccessAdminDashboard(profile?.account_role);

  return useQuery({
    queryKey: queryKeys.adminAnalytics.byPeriod(period, user?.id ?? null),
    queryFn: () => getAdminAnalyticsProvider().fetchAdminAnalytics(period),
    enabled: !!user && canAccess,
    staleTime: STALE_MS,
  });
}
