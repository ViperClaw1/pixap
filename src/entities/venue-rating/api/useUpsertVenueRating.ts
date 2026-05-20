import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";

export type UpsertVenueRatingInput = {
  venueId: string;
  rating: number;
  ratingContext?: string;
};

export function useUpsertVenueRating() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ venueId, rating, ratingContext = "onboarding" }: UpsertVenueRatingInput) => {
      const { data, error } = await supabase
        .from("venue_ratings")
        .upsert(
          {
            user_id: user!.id,
            venue_id: venueId,
            rating,
            rating_context: ratingContext,
            rated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,venue_id" },
        )
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.venueRatings.mine(user?.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.onboardingVenues.prefix });
    },
  });
}
