import type { TFunction } from "i18next";
import type { PixAIVibeTimeline } from "../api/usePixAI";

export type VibeRouteAssistantParams = {
  timeline: PixAIVibeTimeline;
  city: string;
  mood: string;
  stopCount: number;
};

export function buildVibeRouteAssistantMessage(params: VibeRouteAssistantParams, t: TFunction): string {
  if (params.stopCount === 0) {
    return t("vibeMatch.routeAssistantEmpty", { city: params.city });
  }
  const timelineKey = params.timeline === "late_night" ? "lateNight" : params.timeline;
  const vibe = t(`vibeMatch.timeline.${timelineKey}`);
  return t("vibeMatch.routeAssistantMessage", {
    vibe,
    city: params.city,
    tags: params.mood,
    count: params.stopCount,
  });
}
