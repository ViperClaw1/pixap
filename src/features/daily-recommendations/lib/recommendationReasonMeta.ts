import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";
import type { TFunction } from "i18next";
import { translateRecommendationReason } from "./translateRecommendationReason";

export type RecommendationReasonIconName = ComponentProps<typeof Ionicons>["name"];

const REASON_KEY_BY_VALUE: Record<string, string> = {
  "Matches your nightlife vibe": "matchesNightlifeVibe",
  "Trending tonight": "trendingTonight",
  "Buzzing right now": "buzzingRightNow",
  "New spot for you": "newSpotForYou",
  "Popular with the community": "popularWithCommunity",
  "Good fit for tonight": "goodFitForTonight",
};

export function resolveRecommendationReasonKey(reason: string): string | null {
  return REASON_KEY_BY_VALUE[reason] ?? null;
}

export function getRecommendationReasonIcon(reason: string): RecommendationReasonIconName {
  const key = resolveRecommendationReasonKey(reason);
  switch (key) {
    case "matchesNightlifeVibe":
      return "people-outline";
    case "newSpotForYou":
      return "sparkles-outline";
    case "popularWithCommunity":
      return "flame-outline";
    case "trendingTonight":
    case "buzzingRightNow":
      return "flame";
    case "goodFitForTonight":
      return "calendar-outline";
    default:
      return "checkmark-circle-outline";
  }
}

export function formatRecommendationReasonLabel(reason: string, t: TFunction): string {
  return translateRecommendationReason(reason, t);
}
