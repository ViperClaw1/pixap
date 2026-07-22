import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  venue_phone: string | null;
  venue_contact_whatsapp: string | null;
  date_time: string;
  persons: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  status: string;
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
  const queryClient = useQueryClient();
  const queryKey = queryKeys.adminAnalytics.waBookings(period, user?.id ?? null);

  const query = useQuery({
    queryKey,
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

  useEffect(() => {
    if (!user || !canAccess) return;
    const invalidate = () => void queryClient.invalidateQueries({ queryKey });
    const channel = supabase
      .channel("admin_wa_bookings_list_rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bookings" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "cart_items" }, invalidate)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, canAccess, queryClient, queryKey]);

  return query;
}
