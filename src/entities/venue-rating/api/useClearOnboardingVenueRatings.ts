import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";

export function useClearOnboardingVenueRatings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("venue_ratings")
        .delete()
        .eq("user_id", user!.id)
        .eq("rating_context", "onboarding");
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.venueRatings.mine(user?.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.onboardingVenues.prefix });
    },
  });
}
