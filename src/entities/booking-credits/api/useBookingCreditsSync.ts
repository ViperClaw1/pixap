import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import { queryKeys } from "@/shared/api/queryKeys";
import type { BookingCreditsStatus } from "../model/types";

export function useBookingCreditsSync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const syncBalance = useCallback(
    ({ balance }: { balance: number | null }) => {
      const queryKey = queryKeys.bookingCredits.wallet(userId);
      const current = queryClient.getQueryData<BookingCreditsStatus | null>(queryKey);
      if (balance != null && balance >= 0 && current) {
        queryClient.setQueryData<BookingCreditsStatus>(queryKey, {
          ...current,
          balance,
        });
        return;
      }
      void queryClient.invalidateQueries({ queryKey });
    },
    [queryClient, userId],
  );

  const refreshBalance = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.bookingCredits.wallet(userId) }),
    [queryClient, userId],
  );

  return { syncBalance, refreshBalance };
}
