import { BOOKING_SLOT_STEP_MINUTES } from "@/entities/booking/lib/bookingSlots";
import {
  formatVibeMinutesLabel,
  VIBE_WINDOW_SLOT_STEP_MINUTES,
} from "@/entities/pixai/lib/vibeBookingWindow";
import { useEffect, useMemo, useState } from "react";
import type { VibeCustomTimeWindow } from "./vibeTimeSelection";

/** Default same-day lower bound when current time is earlier (e.g. before venue hours). */
export const VIBE_CUSTOM_WINDOW_MIN_MINUTES = 6 * 60;

/** Next-day upper bound (clock minutes on the following calendar day). */
export const VIBE_CUSTOM_WINDOW_MAX_MINUTES = 2 * 60;

const SLIDER_STEP_MINUTES = BOOKING_SLOT_STEP_MINUTES;
const MAX_EXTENDED = 24 * 60 + VIBE_CUSTOM_WINDOW_MAX_MINUTES;
const MAX_STEP = MAX_EXTENDED / SLIDER_STEP_MINUTES;
const MIN_STEP_GAP = VIBE_WINDOW_SLOT_STEP_MINUTES / SLIDER_STEP_MINUTES;
const SLIDER_EPOCH_MS = SLIDER_STEP_MINUTES * 60_000;

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

export function ceilClockMinutesFromDate(date: Date): number {
  const msFromMidnight =
    date.getHours() * 3_600_000 +
    date.getMinutes() * 60_000 +
    date.getSeconds() * 1_000 +
    date.getMilliseconds();
  const stepMs = SLIDER_STEP_MINUTES * 60_000;
  const ceiledMs = Math.ceil(msFromMidnight / stepMs) * stepMs;
  if (ceiledMs >= 24 * 60 * 60_000) {
    return 24 * 60 - SLIDER_STEP_MINUTES;
  }
  return ceiledMs / 60_000;
}

function resolveMinExtended(now: Date): number {
  const fromNow = clockToExtended(ceilClockMinutesFromDate(now));
  const maxAllowedMin = MAX_EXTENDED - VIBE_WINDOW_SLOT_STEP_MINUTES;
  return Math.min(maxAllowedMin, fromNow);
}

export type CustomTimeWindowAxis = {
  minMinutes: number;
  maxMinutes: number;
  minStep: number;
  maxStep: number;
  minStepGap: number;
  minutesToSliderStep: (minutes: number) => number;
  sliderStepToMinutes: (step: number) => number;
  xToSliderStep: (x: number, usableWidth: number) => number;
  sliderStepToX: (step: number, usableWidth: number) => number;
  normalizeCustomTimeWindow: (window: VibeCustomTimeWindow) => VibeCustomTimeWindow;
};

export function createCustomTimeWindowAxis(now = new Date()): CustomTimeWindowAxis {
  const minExtended = resolveMinExtended(now);
  const minStep = minExtended / SLIDER_STEP_MINUTES;
  const minMinutes = extendedToClock(minExtended);

  const clampExtended = (extended: number) => Math.max(minExtended, Math.min(MAX_EXTENDED, extended));

  const clampStep = (step: number) => Math.max(minStep, Math.min(MAX_STEP, step));

  const minutesToSliderStep = (minutes: number): number =>
    clampStep(Math.round(clockToExtended(minutes) / SLIDER_STEP_MINUTES));

  const sliderStepToMinutes = (step: number): number =>
    extendedToClock(clampStep(step) * SLIDER_STEP_MINUTES);

  const xToSliderStep = (x: number, usableWidth: number): number => {
    if (usableWidth <= 0) return minStep;
    const ratio = Math.max(0, Math.min(1, x / usableWidth));
    return clampStep(Math.round(minStep + ratio * (MAX_STEP - minStep)));
  };

  const sliderStepToX = (step: number, usableWidth: number): number => {
    if (usableWidth <= 0) return 0;
    return ((clampStep(step) - minStep) / (MAX_STEP - minStep)) * usableWidth;
  };

  const normalizeCustomTimeWindow = (window: VibeCustomTimeWindow): VibeCustomTimeWindow => {
    let startStep = minutesToSliderStep(window.startMinutes);
    let endStep = minutesToSliderStep(window.endMinutes);
    if (endStep <= startStep) {
      endStep = Math.min(MAX_STEP, startStep + MIN_STEP_GAP);
    }
    return {
      startMinutes: sliderStepToMinutes(startStep),
      endMinutes: sliderStepToMinutes(endStep),
    };
  };

  return {
    minMinutes,
    maxMinutes: VIBE_CUSTOM_WINDOW_MAX_MINUTES,
    minStep,
    maxStep: MAX_STEP,
    minStepGap: MIN_STEP_GAP,
    minutesToSliderStep,
    sliderStepToMinutes,
    xToSliderStep,
    sliderStepToX,
    normalizeCustomTimeWindow,
  };
}

/** @deprecated Use `createCustomTimeWindowAxis()` for a time-aware axis. */
export const CUSTOM_TIME_WINDOW_AXIS = createCustomTimeWindowAxis();

export function minutesToSliderStep(minutes: number): number {
  return CUSTOM_TIME_WINDOW_AXIS.minutesToSliderStep(minutes);
}

export function sliderStepToMinutes(step: number): number {
  return CUSTOM_TIME_WINDOW_AXIS.sliderStepToMinutes(step);
}

export function xToSliderStep(x: number, usableWidth: number): number {
  return CUSTOM_TIME_WINDOW_AXIS.xToSliderStep(x, usableWidth);
}

export function sliderStepToX(step: number, usableWidth: number): number {
  return CUSTOM_TIME_WINDOW_AXIS.sliderStepToX(step, usableWidth);
}

export function formatCustomWindowEdgeLabel(minutes: number): string {
  return formatVibeMinutesLabel(minutes);
}

export function normalizeCustomTimeWindow(window: VibeCustomTimeWindow): VibeCustomTimeWindow {
  return CUSTOM_TIME_WINDOW_AXIS.normalizeCustomTimeWindow(window);
}

export function customWindowsEqual(a: VibeCustomTimeWindow, b: VibeCustomTimeWindow): boolean {
  return a.startMinutes === b.startMinutes && a.endMinutes === b.endMinutes;
}

function sliderEpochFromNow(now = Date.now()): number {
  return Math.floor(now / SLIDER_EPOCH_MS);
}

/** Recomputes slider bounds when the 5-minute grid advances. */
export function useCustomTimeWindowAxis(): CustomTimeWindowAxis {
  const [epoch, setEpoch] = useState(() => sliderEpochFromNow());

  useEffect(() => {
    const syncEpoch = () => setEpoch(sliderEpochFromNow());
    const msUntilNextEpoch = SLIDER_EPOCH_MS - (Date.now() % SLIDER_EPOCH_MS);
    const timeoutId = setTimeout(syncEpoch, msUntilNextEpoch);
    const intervalId = setInterval(syncEpoch, SLIDER_EPOCH_MS);
    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, []);

  return useMemo(() => createCustomTimeWindowAxis(new Date()), [epoch]);
}
