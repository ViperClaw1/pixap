import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import type { OnboardingVenue } from "../model/types";

type RpcRow = {
  venue_id: string;
  name: string;
  description: string;
  tags: string[] | null;
  images: string[] | null;
  city: string | null;
  category_name: string | null;
  match_score: number;
  rating: number;
};

export function useRecommendedOnboardingVenues(offset: number, enabled = true) {
  const limit = 8;

  return useQuery({
    queryKey: queryKeys.onboardingVenues.page(offset),
    enabled,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<OnboardingVenue[]> => {
      const { data, error } = await supabase.rpc("get_recommended_onboarding_venues", {
        p_limit: limit,
        p_offset: offset,
      });
      if (error) throw error;
      return ((data ?? []) as RpcRow[]).map((row) => ({
        venue_id: row.venue_id,
        name: row.name,
        description: row.description ?? "",
        tags: row.tags ?? [],
        images: row.images ?? [],
        city: row.city,
        category_name: row.category_name ?? "",
        match_score: Number(row.match_score ?? 0),
        rating: Number(row.rating ?? 0),
      }));
    },
  });
}
