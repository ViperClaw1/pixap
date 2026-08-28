import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import { queryKeys } from "@/shared/api/queryKeys";
import { parsePixaiCreditsPayload } from "../lib/parsePixaiCreditsPayload";
import type { BookingCreditsStatus } from "../model/types";

export function useBookingCreditsSync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const syncBalance = useCallback(
    (payload: { balance: number | null; charged?: number }) => {
      if (!userId) return;

      const queryKey = queryKeys.bookingCredits.wallet(userId);
      const charged =
        typeof payload.charged === "number" && Number.isFinite(payload.charged) ? payload.charged : 0;

      const serverBalance =
        typeof payload.balance === "number" && Number.isFinite(payload.balance) && payload.balance >= 0
          ? payload.balance
          : null;

      queryClient.setQueryData<BookingCreditsStatus | null>(queryKey, (current) => {
        if (!current) return current;

        let nextBalance = serverBalance;
        if (nextBalance == null && charged > 0 && current.balance >= 0) {
          nextBalance = Math.max(0, Math.round((current.balance - charged) * 100) / 100);
        }
        if (nextBalance == null) return current;

        return { ...current, balance: nextBalance };
      });

      void queryClient.refetchQueries({ queryKey, type: "active" });
    },
    [queryClient, userId],
  );

  const applyPixaiCredits = useCallback(
    (raw: unknown) => {
      const credits = parsePixaiCreditsPayload(raw) ?? { balance: null, charged: 0.25 };
      syncBalance(credits);
    },
    [syncBalance],
  );

  const refreshBalance = useCallback(
    () => queryClient.refetchQueries({ queryKey: queryKeys.bookingCredits.wallet(userId), type: "active" }),
    [queryClient, userId],
  );

  return { syncBalance, applyPixaiCredits, refreshBalance };
}
