import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";

export function useOnboardingRatedVenueIds() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.venueRatings.mine(user?.id),
    enabled: Boolean(user?.id),
    staleTime: 15 * 1000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("venue_ratings")
        .select("venue_id")
        .eq("user_id", user!.id)
        .eq("rating_context", "onboarding");
      if (error) throw error;
      return (data ?? []).map((row) => String((row as { venue_id: string }).venue_id));
    },
  });
}
