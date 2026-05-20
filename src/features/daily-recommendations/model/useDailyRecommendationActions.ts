import { Share } from "react-native";
import { useToggleFavorite } from "@/entities/favorite";
import {
  useTrackRecommendationEvent,
  useTrackRecommendationInteraction,
  type DailyRecommendation,
} from "@/entities/daily-recommendation";

type Params = {
  onOpenBooking: (venueId: string) => void;
};

export function useDailyRecommendationActions({ onOpenBooking }: Params) {
  const toggleFavorite = useToggleFavorite();
  const trackInteraction = useTrackRecommendationInteraction();
  const trackEvent = useTrackRecommendationEvent();

  const trackOpen = (recommendation: DailyRecommendation) => {
    trackEvent.mutate({
      event_name: "daily_recommendation_clicked",
      payload: { venue_id: recommendation.venue_id, generated_rank: recommendation.generated_rank },
    });
    trackInteraction.mutate({
      venueId: recommendation.venue_id,
      interactionType: "open",
      source: "daily_screen",
      metadata: { generated_rank: recommendation.generated_rank },
    });
  };

  const trackImpression = (recommendation: DailyRecommendation) => {
    trackInteraction.mutate({
      venueId: recommendation.venue_id,
      interactionType: "impression",
      source: "daily_screen",
      metadata: { generated_rank: recommendation.generated_rank },
    });
  };

  const onSave = (recommendation: DailyRecommendation, isFavorite: boolean) => {
    toggleFavorite.mutate({ businessCardId: recommendation.venue_id, isFavorite });
    trackInteraction.mutate({
      venueId: recommendation.venue_id,
      interactionType: "save",
      source: "daily_screen",
      metadata: { generated_rank: recommendation.generated_rank, is_favorite_before: isFavorite },
    });
  };

  const onBook = (recommendation: DailyRecommendation) => {
    onOpenBooking(recommendation.venue_id);
    trackInteraction.mutate({
      venueId: recommendation.venue_id,
      interactionType: "book",
      source: "daily_screen",
      metadata: { generated_rank: recommendation.generated_rank },
    });
  };

  const onShare = async (recommendation: DailyRecommendation) => {
    await Share.share({
      message: `${recommendation.name} — ${recommendation.description}`.trim(),
    });
    trackInteraction.mutate({
      venueId: recommendation.venue_id,
      interactionType: "share",
      source: "daily_screen",
      metadata: { generated_rank: recommendation.generated_rank },
    });
  };

  const onDismiss = (recommendation: DailyRecommendation) => {
    trackInteraction.mutate({
      venueId: recommendation.venue_id,
      interactionType: "dismiss",
      source: "daily_screen",
      metadata: { generated_rank: recommendation.generated_rank },
    });
  };

  return {
    trackOpen,
    trackImpression,
    onSave,
    onBook,
    onShare,
    onDismiss,
  };
}
