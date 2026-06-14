import type { PixAIVibeTimeline } from "@/entities/pixai";
import type { VibeTimeWindowContext } from "@/entities/pixai/lib/vibeBookingWindow";

export type VibeTimeSelectionMode = "preset" | "custom";

export type VibeCustomTimeWindow = {
  startMinutes: number;
  endMinutes: number;
};

export type VibeAppliedTimeSelection = {
  mode: VibeTimeSelectionMode;
  timeline: PixAIVibeTimeline;
  customWindow: VibeCustomTimeWindow;
};

export function buildVibeTimeWindowContext(
  selection: VibeAppliedTimeSelection,
): VibeTimeWindowContext {
  if (selection.mode === "preset") {
    return { kind: "preset", timeline: selection.timeline };
  }
  return {
    kind: "custom",
    startMinutes: selection.customWindow.startMinutes,
    endMinutes: selection.customWindow.endMinutes,
  };
}

/** Maps a custom clock window to the closest preset for venue search scoring. */
export function inferPresetTimelineFromCustomWindow(
  startMinutes: number,
  endMinutes: number,
): PixAIVibeTimeline {
  const wrapsMidnight = startMinutes > endMinutes;
  if (
    wrapsMidnight ||
    startMinutes >= 22 * 60 ||
    endMinutes <= 2 * 60 + 30
  ) {
    return "night";
  }
  const mid = (startMinutes + endMinutes) / 2;
  if (mid >= 17 * 60) return "evening";
  return "day";
}

export function inferSearchTimelineFromSelection(selection: VibeAppliedTimeSelection): PixAIVibeTimeline {
  if (selection.mode === "preset") return selection.timeline;
  return inferPresetTimelineFromCustomWindow(
    selection.customWindow.startMinutes,
    selection.customWindow.endMinutes,
  );
}
