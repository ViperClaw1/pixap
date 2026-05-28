import type { QueryClient } from "@tanstack/react-query";
import { fetchBusinessCardById } from "@/entities/business-card/api/fetchBusinessCardById";
import { queryKeys } from "@/shared/api/queryKeys";

export function prefetchBusinessCard(queryClient: QueryClient, placeId: string, language: string) {
  return queryClient.prefetchQuery({
    queryKey: queryKeys.businessCards.byId(placeId, language),
    queryFn: () => fetchBusinessCardById(placeId, language),
    staleTime: 30_000,
  });
}
