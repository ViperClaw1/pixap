import type { PixAIPlace } from "@/entities/pixai";
import type { BookingRecommendationView } from "../model/types";

/** Applies exclude + rerank using only ids present in `placeOptions` (stable objects from parent). */
export function buildEffectivePlaces(
  placeOptions: PixAIPlace[],
  view: BookingRecommendationView,
): PixAIPlace[] {
  if (view.excludedPlaceIds.length === 0 && view.rerankedPlaceIds.length === 0) {
    return placeOptions;
  }

  const excluded = new Set(view.excludedPlaceIds);
  const filtered = placeOptions.filter((p) => !excluded.has(p.id));
  const idSet = new Set(filtered.map((p) => p.id));
  const byId = new Map(filtered.map((p) => [p.id, p] as const));

  const head = view.rerankedPlaceIds.filter((id) => idSet.has(id));
  const used = new Set(head);
  const tail = filtered.filter((p) => !used.has(p.id));

  return [...head.map((id) => byId.get(id)!), ...tail];
}
