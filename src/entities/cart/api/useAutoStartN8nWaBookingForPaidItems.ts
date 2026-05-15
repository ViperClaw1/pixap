import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/api/queryKeys";
import type { CartItem } from "./useCartItems";
import { startN8nWaBooking } from "../lib/n8nWaBookingStart";
import { devWarn } from "@/shared/lib/devLog";

export function useAutoStartN8nWaBookingForPaidItems(
  paidServiceDrafts: CartItem[],
  enabled: boolean,
  accessToken: string | undefined,
  userId: string | undefined,
) {
  const queryClient = useQueryClient();
  const n8nStartingRef = useRef(new Set<string>());
  const n8nStartFailedRef = useRef(new Set<string>());

  useEffect(() => {
    if (!enabled || !accessToken || !userId) return;

    for (const item of paidServiceDrafts) {
      if (item.wa_n8n_started_at) continue;
      if (n8nStartFailedRef.current.has(item.id)) continue;
      if (n8nStartingRef.current.has(item.id)) continue;
      if (!item.business_card?.contact_whatsapp?.trim()) {
        n8nStartFailedRef.current.add(item.id);
        continue;
      }

      n8nStartingRef.current.add(item.id);
      void startN8nWaBooking(item.id, accessToken)
        .then((result) => {
          if (!result.ok) {
            devWarn("[n8n-wa-booking-start]", result.message);
            n8nStartFailedRef.current.add(item.id);
          }
        })
        .finally(() => {
          n8nStartingRef.current.delete(item.id);
          void queryClient.invalidateQueries({ queryKey: queryKeys.cart.items(userId) });
        });
    }
  }, [accessToken, enabled, paidServiceDrafts, queryClient, userId]);
}
