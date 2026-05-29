import type { TFunction } from "i18next";

const REASON_KEY_BY_VALUE: Record<string, string> = {
  "Matches your nightlife vibe": "matchesNightlifeVibe",
  "Trending tonight": "trendingTonight",
  "Buzzing right now": "buzzingRightNow",
  "New spot for you": "newSpotForYou",
  "Popular with the community": "popularWithCommunity",
  "Good fit for tonight": "goodFitForTonight",
};

export function translateRecommendationReason(reason: string, t: TFunction): string {
  const key = REASON_KEY_BY_VALUE[reason];
  if (!key) return reason;
  return t(`dailyRecommendations.reasons.${key}`, { defaultValue: reason });
}
