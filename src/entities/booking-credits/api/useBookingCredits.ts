import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { parseBookingCreditsStatus } from "../lib/parseBookingCreditsStatus";
import type { BookingCreditsStatus } from "../model/types";

export function useBookingCredits() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.bookingCredits.wallet(user?.id),
    enabled: Boolean(user?.id),
    staleTime: 30 * 1000,
    queryFn: async (): Promise<BookingCreditsStatus | null> => {
      const { data, error } = await supabase.rpc("get_booking_credits_status");
      if (error) throw error;
      return parseBookingCreditsStatus(data);
    },
  });

  return {
    ...query,
    credits: query.data,
    balance: query.data?.balance ?? 0,
    refresh: async () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.bookingCredits.wallet(user?.id) }),
  };
}
