import type { BusinessCard } from "@/entities/business-card";
import type { DailyRecommendation } from "@/entities/daily-recommendation";

export function recommendationToBusinessCard(recommendation: DailyRecommendation): BusinessCard {
  return {
    id: recommendation.venue_id,
    name: recommendation.name,
    images: recommendation.images,
    category_id: null,
    city: recommendation.city,
    address: "",
    rating: recommendation.rating,
    tags: recommendation.tags,
    description: recommendation.description,
    booking_price: 0,
    phone: "",
    contact_whatsapp: null,
    type: "recommended",
    created_at: "",
  };
}
