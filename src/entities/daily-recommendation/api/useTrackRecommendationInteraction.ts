import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import { supabase } from "@/shared/api/supabase/client";
import type { RecommendationInteractionSource, RecommendationInteractionType } from "../model/types";

type Input = {
  venueId: string;
  interactionType: RecommendationInteractionType;
  source: RecommendationInteractionSource;
  metadata?: Record<string, unknown>;
};

export function useTrackRecommendationInteraction() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ venueId, interactionType, source, metadata = {} }: Input) => {
      if (!user?.id) return;
      const { error } = await supabase.from("recommendation_interactions").insert({
        user_id: user.id,
        venue_id: venueId,
        interaction_type: interactionType,
        source,
        metadata,
      });
      if (error) throw error;
    },
  });
}
