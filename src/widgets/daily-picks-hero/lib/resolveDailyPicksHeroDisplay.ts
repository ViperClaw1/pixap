import type { BusinessCard } from "@/entities/business-card";
import type { DailyRecommendation } from "@/entities/daily-recommendation";

export type DailyPicksHeroSource = "recommendation" | "recent" | "placeholder";

export type DailyPicksHeroDisplay = {
  source: DailyPicksHeroSource;
  recommendation: DailyRecommendation | null;
};

function businessCardToHeroRecommendation(card: BusinessCard): DailyRecommendation {
  return {
    venue_id: card.id,
    generated_rank: 0,
    recommendation_score: 0,
    recommendation_reasons: [],
    name: card.name,
    description: card.description,
    tags: card.tags,
    images: card.images,
    city: card.city,
    rating: card.rating,
  };
}

function pickRecentFallbackCard(cards: BusinessCard[]): BusinessCard | null {
  if (!cards.length) return null;
  const withImage = cards.find((card) => card.images.length > 0 || card.image);
  return withImage ?? cards[0];
}

export function resolveDailyPicksHeroDisplay(
  dailyRecommendations: DailyRecommendation[],
  fallbackCards: BusinessCard[],
): DailyPicksHeroDisplay {
  const topRecommendation = dailyRecommendations[0];
  if (topRecommendation) {
    return { source: "recommendation", recommendation: topRecommendation };
  }

  const recent = pickRecentFallbackCard(fallbackCards);
  if (recent) {
    return { source: "recent", recommendation: businessCardToHeroRecommendation(recent) };
  }

  return { source: "placeholder", recommendation: null };
}
