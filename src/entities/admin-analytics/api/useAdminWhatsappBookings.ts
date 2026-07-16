import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/app/providers/AuthProvider";
import { useProfile } from "@/entities/user";
import { canAccessAdminDashboard } from "../lib/canAccessAdminDashboard";
import type { AnalyticsPeriod } from "../model/types";

export type AdminWhatsappBookingRow = {
  id: string;
  venue_name: string;
  venue_address: string | null;
  date_time: string;
  persons: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  status: "created" | "paid" | "expired";
  wa_status_lines: unknown;
  wa_confirmable: boolean;
  wa_confirmed_price: string | null;
  wa_payment_link: string | null;
  response_deadline_at: string | null;
  response_timed_out_at: string | null;
  created_at: string;
};

const STALE_MS = 30 * 1000;

export function useAdminWhatsappBookings(period: AnalyticsPeriod, limit = 50) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const canAccess = canAccessAdminDashboard(profile?.account_role);

  return useQuery({
    queryKey: queryKeys.adminAnalytics.waBookings(period, user?.id ?? null),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_whatsapp_bookings_list", {
        p_period_days: period,
        p_limit: limit,
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as AdminWhatsappBookingRow[];
    },
    enabled: !!user && canAccess,
    staleTime: STALE_MS,
  });
}
