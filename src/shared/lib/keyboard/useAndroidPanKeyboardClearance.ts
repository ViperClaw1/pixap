import { useCallback, useEffect, useRef } from "react";
import type { ElementRef } from "react";
import { Dimensions, Keyboard, Platform, TextInput, type View } from "react-native";
import { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

/** Extra lift on Android when `softwareKeyboardLayoutMode: pan` leaves input slightly under the keyboard. */
export const ANDROID_PAN_KEYBOARD_CLEARANCE = 22;

const ANDROID_KEYBOARD_ANIM_MS = 280;
/** Pan resize below this is treated as keyboard closed (status bar / minor layout noise). */
const ANDROID_PAN_KEYBOARD_SHRINK_THRESHOLD_PX = 48;

type MeasurableView = Pick<View, "measureInWindow">;

export type AndroidPanKeyboardClearanceOptions = {
  clearance?: number;
  getFocusedInput?: () => ElementRef<typeof TextInput> | null;
  /** Footer container to measure (preferred over input + padding). */
  getMeasureTarget?: () => MeasurableView | null;
  /** Pixels below the input baseline when measuring via `getFocusedInput` only. */
  footerPaddingBelowInput?: number;
  /** After system pan, measure remaining overlap and set lift. */
  measureAfterPan?: boolean;
  /**
   * Set measured lift instantly (no withTiming) — avoids a second footer animation after pan.
   */
  snapMeasureAfterPan?: boolean;
  /**
   * Apply clearance instantly on focus (no withTiming) so system pan and offset start together —
   * avoids a visible second scroll stage.
   */
  instantOnFocus?: boolean;
};

const MAX_MEASURED_LIFT_PX = 120;

function resolveKeyboardAnimationDuration(eventDuration?: number): number {
  if (eventDuration != null && eventDuration > 80) {
    return eventDuration;
  }
  return ANDROID_KEYBOARD_ANIM_MS;
}

function resolveOptions(
  optionsOrClearance: number | AndroidPanKeyboardClearanceOptions,
): AndroidPanKeyboardClearanceOptions {
  return typeof optionsOrClearance === "number" ? { clearance: optionsOrClearance } : optionsOrClearance;
}

/**
 * Android pan mode lifts the window during the keyboard animation; this hook adds a small
 * clearance lift in parallel (started on focus) so motion stays one continuous scroll.
 */
export function useAndroidPanKeyboardClearance(
  isActive = true,
  optionsOrClearance: number | AndroidPanKeyboardClearanceOptions = ANDROID_PAN_KEYBOARD_CLEARANCE,
) {
  const options = resolveOptions(optionsOrClearance);
  const clearance = options.clearance ?? ANDROID_PAN_KEYBOARD_CLEARANCE;
  const extraLift = useSharedValue(0);
  const getFocusedInputRef = useRef(options.getFocusedInput);
  getFocusedInputRef.current = options.getFocusedInput;
  const getMeasureTargetRef = useRef(options.getMeasureTarget);
  getMeasureTargetRef.current = options.getMeasureTarget;
  const snapMeasureAfterPan = options.snapMeasureAfterPan ?? false;
  const instantOnFocus = options.instantOnFocus ?? false;
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  const applyInstantClearance = useCallback(() => {
    if (!isActiveRef.current || Platform.OS !== "android") return;
    cancelAnimation(extraLift);
    extraLift.value = clearance;
  }, [clearance, extraLift]);

  const resetInstantClearance = useCallback(() => {
    if (Platform.OS !== "android") return;
    cancelAnimation(extraLift);
    extraLift.value = 0;
  }, [extraLift]);

  const animateLift = useCallback(
    (toValue: number, duration?: number) => {
      if (Platform.OS !== "android") return;
      extraLift.value = withTiming(toValue, {
        duration: duration ?? ANDROID_KEYBOARD_ANIM_MS,
        easing: Easing.out(Easing.cubic),
      });
    },
    [extraLift],
  );

  const onComposerFocus = useCallback(() => {
    if (!isActive || Platform.OS !== "android") return;
    if (instantOnFocus) {
      applyInstantClearance();
      return;
    }
    animateLift(clearance);
  }, [animateLift, applyInstantClearance, clearance, instantOnFocus, isActive]);

  const onComposerBlur = useCallback(() => {
    if (instantOnFocus) {
      resetInstantClearance();
      return;
    }
    animateLift(0);
  }, [animateLift, instantOnFocus, resetInstantClearance]);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    if (instantOnFocus) {
      let baselineWindowHeight = Dimensions.get("window").height;

      const syncLiftFromWindowHeight = (windowHeight: number) => {
        if (!isActiveRef.current) return;
        const shrunkBy = baselineWindowHeight - windowHeight;
        if (shrunkBy > ANDROID_PAN_KEYBOARD_SHRINK_THRESHOLD_PX) {
          applyInstantClearance();
          return;
        }
        resetInstantClearance();
        baselineWindowHeight = windowHeight;
      };

      const dimSub = Dimensions.addEventListener("change", ({ window }) => {
        syncLiftFromWindowHeight(window.height);
      });

      const hideSub = Keyboard.addListener("keyboardDidHide", () => {
        resetInstantClearance();
        baselineWindowHeight = Dimensions.get("window").height;
      });

      const showSub = Keyboard.addListener("keyboardDidShow", () => {
        applyInstantClearance();
      });

      return () => {
        dimSub.remove();
        hideSub.remove();
        showSub.remove();
      };
    }

    const hideSub = Keyboard.addListener("keyboardDidHide", (event) => {
      animateLift(0, resolveKeyboardAnimationDuration(event.duration));
    });

    const showSub = Keyboard.addListener("keyboardDidShow", (event) => {
      if (!options.measureAfterPan) return;

      const keyboardTop =
        event.endCoordinates.screenY ??
        Dimensions.get("window").height - event.endCoordinates.height;
      const duration = resolveKeyboardAnimationDuration(event.duration);
      const footerPad = options.footerPaddingBelowInput ?? 0;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const measureTarget =
            getMeasureTargetRef.current?.() ?? getFocusedInputRef.current?.();
          if (!measureTarget || typeof measureTarget.measureInWindow !== "function") return;

          measureTarget.measureInWindow((_x, y, _w, h) => {
            const footerBottom =
              getMeasureTargetRef.current?.() != null ? y + h : y + h + footerPad;
            const overlap = footerBottom - keyboardTop;
            const targetLift =
              overlap > 0.5 ? Math.min(MAX_MEASURED_LIFT_PX, overlap + clearance) : 0;

            if (snapMeasureAfterPan) {
              extraLift.value = targetLift;
              return;
            }
            animateLift(targetLift, duration);
          });
        });
      });
    });

    return () => {
      hideSub.remove();
      showSub.remove();
    };
  }, [
    animateLift,
    applyInstantClearance,
    clearance,
    extraLift,
    instantOnFocus,
    options.footerPaddingBelowInput,
    options.measureAfterPan,
    resetInstantClearance,
    snapMeasureAfterPan,
  ]);

  useEffect(() => {
    if (Platform.OS !== "android" || isActive) return;
    extraLift.value = 0;
  }, [extraLift, isActive]);

  const androidLiftStyle = useAnimatedStyle(
    () => ({
      transform: [{ translateY: -extraLift.value }],
    }),
    [extraLift],
  );

  return { androidLiftStyle, onComposerFocus, onComposerBlur, extraLift };
}
