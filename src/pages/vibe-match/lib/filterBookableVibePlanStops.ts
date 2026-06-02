import type { PixAIVibeTimeline, VibePlanStop } from "@/entities/pixai";
import {
  isTimeSlotBookableNow,
  isTimeSlotInTimelineWindow,
} from "@/entities/pixai/lib/vibeBookingWindow";

export type VibeStopSlotMeta = {
  loading: boolean;
  error: boolean;
  bookable: boolean;
  dateTime: string | null | undefined;
};

export type BookableVibeRouteStop = {
  stop: VibePlanStop;
  meta: VibeStopSlotMeta & { dateTime: string };
};

/** Route stops for display — timeline-based, not filtered by “current time of day”. */
export function filterBookableVibePlanStops(
  plan: VibePlanStop[],
  stopAvailability: VibeStopSlotMeta[],
  timeline: PixAIVibeTimeline,
  nowMs = Date.now(),
): BookableVibeRouteStop[] {
  return plan.flatMap((stop, i) => {
    const meta = stopAvailability[i];
    if (!meta || meta.loading) return [];
    if (!isTimeSlotInTimelineWindow(stop.time_slot, timeline)) return [];

    const resolvedSlot =
      meta.dateTime && isTimeSlotInTimelineWindow(meta.dateTime, timeline) ? meta.dateTime : null;
    const displayTime = resolvedSlot ?? stop.time_slot;
    const hasLiveSlot = resolvedSlot != null && isTimeSlotBookableNow(resolvedSlot, nowMs);

    return [
      {
        stop,
        meta: {
          ...meta,
          bookable: hasLiveSlot,
          dateTime: displayTime,
        },
      },
    ];
  });
}
