import { useCallback, useEffect, useRef } from "react";
import type { ElementRef } from "react";
import { Dimensions, Keyboard, Platform, TextInput } from "react-native";
import { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

/** Extra lift on Android when `softwareKeyboardLayoutMode: pan` leaves input slightly under the keyboard. */
export const ANDROID_PAN_KEYBOARD_CLEARANCE = 22;

const ANDROID_KEYBOARD_ANIM_MS = 280;

export type AndroidPanKeyboardClearanceOptions = {
  clearance?: number;
  getFocusedInput?: () => ElementRef<typeof TextInput> | null;
  /** Pixels below the input baseline counted as footer bottom when measuring gap. */
  footerPaddingBelowInput?: number;
  /** After system pan, measure remaining gap and add lift on top of the current value. */
  measureAfterPan?: boolean;
  /**
   * Apply clearance instantly on focus (no withTiming) so system pan and offset start together —
   * avoids a visible second scroll stage.
   */
  instantOnFocus?: boolean;
};

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
    if (options.instantOnFocus) {
      extraLift.value = clearance;
      return;
    }
    animateLift(clearance);
  }, [animateLift, clearance, extraLift, isActive, options.instantOnFocus]);

  const onComposerBlur = useCallback(() => {
    animateLift(0);
  }, [animateLift]);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const hideSub = Keyboard.addListener("keyboardDidHide", (event) => {
      animateLift(0, resolveKeyboardAnimationDuration(event.duration));
    });

    const showSub = options.measureAfterPan
      ? Keyboard.addListener("keyboardDidShow", (event) => {
          const keyboardTop =
            event.endCoordinates.screenY ??
            Dimensions.get("window").height - event.endCoordinates.height;
          const duration = resolveKeyboardAnimationDuration(event.duration);
          const footerPad = options.footerPaddingBelowInput ?? 0;

          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const input = getFocusedInputRef.current?.();
              if (!input || typeof input.measureInWindow !== "function") return;

              input.measureInWindow((_x, y, _w, h) => {
                const gap = keyboardTop - (y + h + footerPad);
                if (gap <= 0.5) return;
                animateLift(extraLift.value + gap + 2, duration);
              });
            });
          });
        })
      : null;

    return () => {
      hideSub.remove();
      showSub?.remove();
    };
  }, [
    animateLift,
    extraLift,
    options.footerPaddingBelowInput,
    options.measureAfterPan,
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
