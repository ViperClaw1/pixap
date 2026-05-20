import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import type { RecommendationEventName } from "../model/types";

type TrackRecommendationEventInput = {
  event_name: RecommendationEventName;
  payload?: Record<string, unknown>;
};

export function useTrackRecommendationEvent() {
  return useMutation({
    mutationFn: async ({ event_name, payload = {} }: TrackRecommendationEventInput) => {
      const { error } = await supabase.rpc("track_recommendation_event", {
        p_event: { event_name, ...payload },
      });
      if (error) throw error;
    },
  });
}
