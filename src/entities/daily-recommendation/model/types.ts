export type DailyRecommendation = {
  venue_id: string;
  generated_rank: number;
  recommendation_score: number;
  recommendation_reasons: string[];
  name: string;
  description: string;
  tags: string[];
  images: string[];
  city: string | null;
  rating: number;
};

export type RecommendationInteractionType = "impression" | "open" | "dismiss" | "dislike" | "book" | "save" | "share";

export type RecommendationInteractionSource = "daily_screen" | "home_hero" | "push";

export type RecommendationEventName =
  | "daily_recommendations_opened"
  | "daily_recommendation_clicked"
  | "daily_recommendation_action"
  | "daily_recommendations_empty";
