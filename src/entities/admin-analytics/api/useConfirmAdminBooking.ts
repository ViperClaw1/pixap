import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/api/queryKeys";
import { confirmAdminBooking } from "./adminBookingsApi";

export function useConfirmAdminBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (bookingId: string) => confirmAdminBooking(bookingId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminAnalytics.prefix });
    },
  });
}
