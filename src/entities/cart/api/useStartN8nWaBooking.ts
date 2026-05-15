import { useMutation } from "@tanstack/react-query";
import { startN8nWaBooking } from "../lib/n8nWaBookingStart";

export function useStartN8nWaBooking() {
  return useMutation({
    mutationFn: async ({ cartItemId, accessToken }: { cartItemId: string; accessToken: string }) => {
      const result = await startN8nWaBooking(cartItemId, accessToken);
      if (!result.ok) {
        throw new Error(result.message);
      }
    },
    retry: 1,
  });
}
