import { useMutation, useQueryClient } from "@tanstack/react-query";
import { markProfileVerifiedAndInvalidate } from "./profileApi";

export function useMarkProfileVerified() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => markProfileVerifiedAndInvalidate(queryClient, userId),
  });
}
