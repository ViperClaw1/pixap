import type { TFunction } from "i18next";
import type { VibeTimeWindowContext } from "../lib/vibeBookingWindow";
import { formatVibeTimeWindowContextLabel } from "../lib/vibeBookingWindow";

export type VibeRouteAssistantParams = {
  timeWindow: VibeTimeWindowContext;
  city: string;
  mood: string;
  stopCount: number;
};

export function buildVibeRouteAssistantMessage(params: VibeRouteAssistantParams, t: TFunction): string {
  if (params.stopCount === 0) {
    return t("vibeMatch.routeAssistantEmpty", { city: params.city });
  }
  const vibe = formatVibeTimeWindowContextLabel(params.timeWindow, t);
  return t("vibeMatch.routeAssistantMessage", {
    vibe,
    city: params.city,
    tags: params.mood,
    count: params.stopCount,
  });
}
