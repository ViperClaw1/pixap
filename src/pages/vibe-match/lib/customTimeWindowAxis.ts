import { BOOKING_SLOT_STEP_MINUTES } from "@/entities/booking/lib/bookingSlots";
import {
  formatVibeMinutesLabel,
  VIBE_WINDOW_SLOT_STEP_MINUTES,
} from "@/entities/pixai/lib/vibeBookingWindow";
import type { VibeCustomTimeWindow } from "./vibeTimeSelection";

/** Same-day lower bound for the custom time window slider. */
export const VIBE_CUSTOM_WINDOW_MIN_MINUTES = 6 * 60;

/** Next-day upper bound (clock minutes on the following calendar day). */
export const VIBE_CUSTOM_WINDOW_MAX_MINUTES = 2 * 60;

/** Slider thumb/track granularity (30 min). Booking window grid stays 2 h. */
const SLIDER_STEP_MINUTES = BOOKING_SLOT_STEP_MINUTES;
const MIN_EXTENDED = VIBE_CUSTOM_WINDOW_MIN_MINUTES;
const MAX_EXTENDED = 24 * 60 + VIBE_CUSTOM_WINDOW_MAX_MINUTES;
const MIN_STEP = MIN_EXTENDED / SLIDER_STEP_MINUTES;
const MAX_STEP = MAX_EXTENDED / SLIDER_STEP_MINUTES;
const MIN_STEP_GAP = VIBE_WINDOW_SLOT_STEP_MINUTES / SLIDER_STEP_MINUTES;

/** Early-morning clock times belong to the next day on the slider axis. */
export function clockToExtended(minutes: number): number {
  if (minutes < VIBE_CUSTOM_WINDOW_MAX_MINUTES + SLIDER_STEP_MINUTES) {
    return 24 * 60 + minutes;
  }
  return minutes;
}

export function extendedToClock(extended: number): number {
  if (extended >= 24 * 60) return extended - 24 * 60;
  return extended;
}

function clampExtended(extended: number): number {
  return Math.max(MIN_EXTENDED, Math.min(MAX_EXTENDED, extended));
}

function clampStep(step: number): number {
  return Math.max(MIN_STEP, Math.min(MAX_STEP, step));
}

export function minutesToSliderStep(minutes: number): number {
  return clampStep(Math.round(clockToExtended(minutes) / SLIDER_STEP_MINUTES));
}

export function sliderStepToMinutes(step: number): number {
  return extendedToClock(clampStep(step) * SLIDER_STEP_MINUTES);
}

export function xToSliderStep(x: number, usableWidth: number): number {
  if (usableWidth <= 0) return MIN_STEP;
  const ratio = Math.max(0, Math.min(1, x / usableWidth));
  return clampStep(Math.round(MIN_STEP + ratio * (MAX_STEP - MIN_STEP)));
}

export function sliderStepToX(step: number, usableWidth: number): number {
  if (usableWidth <= 0) return 0;
  return ((clampStep(step) - MIN_STEP) / (MAX_STEP - MIN_STEP)) * usableWidth;
}

export function formatCustomWindowEdgeLabel(minutes: number): string {
  return formatVibeMinutesLabel(minutes);
}

export function normalizeCustomTimeWindow(window: VibeCustomTimeWindow): VibeCustomTimeWindow {
  let startStep = minutesToSliderStep(window.startMinutes);
  let endStep = minutesToSliderStep(window.endMinutes);
  if (endStep <= startStep) {
    endStep = Math.min(MAX_STEP, startStep + MIN_STEP_GAP);
  }
  return {
    startMinutes: sliderStepToMinutes(startStep),
    endMinutes: sliderStepToMinutes(endStep),
  };
}

export function customWindowsEqual(a: VibeCustomTimeWindow, b: VibeCustomTimeWindow): boolean {
  return a.startMinutes === b.startMinutes && a.endMinutes === b.endMinutes;
}

export const CUSTOM_TIME_WINDOW_AXIS = {
  minMinutes: VIBE_CUSTOM_WINDOW_MIN_MINUTES,
  maxMinutes: VIBE_CUSTOM_WINDOW_MAX_MINUTES,
  minStep: MIN_STEP,
  maxStep: MAX_STEP,
  minStepGap: MIN_STEP_GAP,
  stepToMinutes: sliderStepToMinutes,
  minutesToStep: minutesToSliderStep,
} as const;
