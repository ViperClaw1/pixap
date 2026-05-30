import type { VibePlanStop } from "@/entities/pixai";
import { isTimeSlotInVibeBookingWindow } from "@/entities/pixai/lib/vibeBookingWindow";

export type VibeStopSlotMeta = {
  loading: boolean;
  error: boolean;
  bookable: boolean;
  dateTime: string | null | undefined;
};

export type BookableVibeRouteStop = {
  stop: VibePlanStop;
  meta: VibeStopSlotMeta & { bookable: true; dateTime: string };
};

/** Keeps stops with a free slot whose time falls inside the vibe booking window. */
export function filterBookableVibePlanStops(
  plan: VibePlanStop[],
  stopAvailability: VibeStopSlotMeta[],
  nowMs = Date.now(),
): BookableVibeRouteStop[] {
  return plan.flatMap((stop, i) => {
    const meta = stopAvailability[i];
    if (!meta || meta.loading || meta.error || !meta.bookable || !meta.dateTime) return [];
    if (!isTimeSlotInVibeBookingWindow(stop.time_slot, nowMs)) return [];
    if (!isTimeSlotInVibeBookingWindow(meta.dateTime, nowMs)) return [];
    return [{ stop, meta: { ...meta, bookable: true, dateTime: meta.dateTime } }];
  });
}
