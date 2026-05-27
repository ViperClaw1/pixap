import { useCallback, useMemo, useRef } from "react";
import { InteractionManager } from "react-native";
import { useToggleFavorite } from "@/entities/favorite";
import {
  useTrackRecommendationEvent,
  useTrackRecommendationInteraction,
  type DailyRecommendation,
} from "@/entities/daily-recommendation";

type Params = {
  onOpenBooking: (venueId: string) => void;
  onRequireAuth: () => void;
  onSharePlace: (recommendation: DailyRecommendation) => void;
  isAuthenticated: boolean;
};

function scheduleInteraction(task: () => void) {
  InteractionManager.runAfterInteractions(task);
}

export function useDailyRecommendationActions({
  onOpenBooking,
  onRequireAuth,
  onSharePlace,
  isAuthenticated,
}: Params) {
  const toggleFavorite = useToggleFavorite();
  const trackInteraction = useTrackRecommendationInteraction();
  const trackEvent = useTrackRecommendationEvent();
  const impressedVenueIdsRef = useRef(new Set<string>());

  const queueInteraction = useCallback(
    (input: Parameters<typeof trackInteraction.mutate>[0]) => {
      scheduleInteraction(() => {
        trackInteraction.mutate(input);
      });
    },
    [trackInteraction],
  );

  const queueEvent = useCallback(
    (input: Parameters<typeof trackEvent.mutate>[0]) => {
      scheduleInteraction(() => {
        trackEvent.mutate(input);
      });
    },
    [trackEvent],
  );

  const trackOpen = useCallback(
    (recommendation: DailyRecommendation) => {
      queueEvent({
        event_name: "daily_recommendation_clicked",
        payload: { venue_id: recommendation.venue_id, generated_rank: recommendation.generated_rank },
      });
      queueInteraction({
        venueId: recommendation.venue_id,
        interactionType: "open",
        source: "daily_screen",
        metadata: { generated_rank: recommendation.generated_rank },
      });
    },
    [queueEvent, queueInteraction],
  );

  const trackImpression = useCallback(
    (recommendation: DailyRecommendation) => {
      if (impressedVenueIdsRef.current.has(recommendation.venue_id)) {
        return;
      }
      impressedVenueIdsRef.current.add(recommendation.venue_id);
      queueInteraction({
        venueId: recommendation.venue_id,
        interactionType: "impression",
        source: "daily_screen",
        metadata: { generated_rank: recommendation.generated_rank },
      });
    },
    [queueInteraction],
  );

  const onSave = useCallback(
    (recommendation: DailyRecommendation, isFavorite: boolean) => {
      if (!isAuthenticated) {
        onRequireAuth();
        return;
      }
      toggleFavorite.mutate({ businessCardId: recommendation.venue_id, isFavorite });
      queueInteraction({
        venueId: recommendation.venue_id,
        interactionType: "save",
        source: "daily_screen",
        metadata: { generated_rank: recommendation.generated_rank, is_favorite_before: isFavorite },
      });
    },
    [isAuthenticated, onRequireAuth, queueInteraction, toggleFavorite],
  );

  const onBook = useCallback(
    (recommendation: DailyRecommendation) => {
      onOpenBooking(recommendation.venue_id);
      queueInteraction({
        venueId: recommendation.venue_id,
        interactionType: "book",
        source: "daily_screen",
        metadata: { generated_rank: recommendation.generated_rank },
      });
    },
    [onOpenBooking, queueInteraction],
  );

  const onShare = useCallback(
    (recommendation: DailyRecommendation) => {
      onSharePlace(recommendation);
      queueInteraction({
        venueId: recommendation.venue_id,
        interactionType: "share",
        source: "daily_screen",
        metadata: { generated_rank: recommendation.generated_rank },
      });
    },
    [onSharePlace, queueInteraction],
  );

  const onDismiss = useCallback(
    (recommendation: DailyRecommendation) => {
      queueInteraction({
        venueId: recommendation.venue_id,
        interactionType: "dismiss",
        source: "daily_screen",
        metadata: { generated_rank: recommendation.generated_rank },
      });
    },
    [queueInteraction],
  );

  return useMemo(
    () => ({
      trackOpen,
      trackImpression,
      onSave,
      onBook,
      onShare,
      onDismiss,
    }),
    [onBook, onDismiss, onSave, onShare, trackImpression, trackOpen],
  );
}
