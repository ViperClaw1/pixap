import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/api/queryKeys";
import { appendBusinessCardImage } from "./appendBusinessCardImage";

type Input = {
  venueId: string;
  imageUrl: string;
};

export function useAppendBusinessCardImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ venueId, imageUrl }: Input) => appendBusinessCardImage(venueId, imageUrl),
    onSuccess: (_images, { venueId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.businessCards.singlePrefix });
      void queryClient.invalidateQueries({ queryKey: queryKeys.businessCards.listPrefix });
      void queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "business_card" &&
          query.queryKey[1] === venueId,
      });
    },
  });
}
