import { useCallback, useEffect, useRef } from "react";
import { Keyboard, Platform, type View } from "react-native";
import {
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { useFooterKeyboardLift, useKeyboardInset } from "@/shared/lib/keyboard";

export const MESSAGE_THREAD_ANDROID_KEYBOARD_TRIM_PX = 64;

export type MessageThreadKeyboardLift = {
  effectiveInset: SharedValue<number>;
  recalculateIosKeyboardLift: () => void;
  beginComposerInteraction: () => void;
  beginPickerInteraction: () => void;
  endComposerInteraction: (refocusInput?: () => void) => void;
  endPickerInteraction: (refocusInput?: () => void) => void;
  isComposerInteractionLocked: () => boolean;
  runWithComposerKeyboardLock: (
    action: () => void | Promise<void>,
    refocusInput?: () => void,
  ) => void;
};

function snapshotComposerLift(liveLift: number, heldLift: number): number {
  return Math.max(liveLift, heldLift);
}

export function useMessageThreadKeyboardLift(
  getFooterAnchor: () => View | null,
): MessageThreadKeyboardLift {
  const androidKeyboardInset = useKeyboardInset({
    gap: 0,
    tabBarHeight: 0,
    ignoreWindowResize: true,
    enabled: Platform.OS === "android",
  });

  const composerInteractionLock = useSharedValue(0);
  const composerInteractionLockJsRef = useRef(0);
  const shouldRestoreKeyboardRef = useRef(false);
  const pickerLiftFrozen = useSharedValue(0);
  const frozenComposerLift = useSharedValue(0);
  const heldKeyboardInset = useSharedValue(0);

  const { lift: iosKeyboardLift, recalculate: recalculateIosKeyboardLift } = useFooterKeyboardLift(
    getFooterAnchor,
    {
      gap: 0,
      enabled: Platform.OS === "ios",
      holdDuringInteraction: composerInteractionLock,
      holdDuringPicker: pickerLiftFrozen,
    },
  );

  useEffect(() => {
    if (Platform.OS !== "ios") return undefined;
    const sub = Keyboard.addListener("keyboardWillChangeFrame", (event) => {
      if (event.endCoordinates.height >= 1) return;
      if (composerInteractionLockJsRef.current > 0) return;
      if (pickerLiftFrozen.value > 0) return;
      heldKeyboardInset.value = 0;
      frozenComposerLift.value = 0;
    });
    return () => sub.remove();
  }, [frozenComposerLift, heldKeyboardInset, pickerLiftFrozen]);

  useAnimatedReaction(
    () => (Platform.OS === "ios" ? iosKeyboardLift.value : androidKeyboardInset.value),
    (current) => {
      if (current > 1) {
        heldKeyboardInset.value = current;
      }
    },
    [androidKeyboardInset, iosKeyboardLift, heldKeyboardInset],
  );

  const effectiveInset = useDerivedValue(() => {
    const current = Platform.OS === "ios" ? iosKeyboardLift.value : androidKeyboardInset.value;
    const holdingComposer =
      Platform.OS === "ios" &&
      (pickerLiftFrozen.value > 0 || composerInteractionLock.value > 0);

    if (holdingComposer) {
      if (current > 1) return current;
      const frozen = frozenComposerLift.value;
      if (frozen > 1) return frozen;
      return heldKeyboardInset.value > 1 ? heldKeyboardInset.value : 0;
    }

    return current > 1 ? current : 0;
  });

  const captureRestoreIntent = useCallback(() => {
    if (Platform.OS === "ios") {
      const snap = snapshotComposerLift(iosKeyboardLift.value, heldKeyboardInset.value);
      if (snap > 1) {
        shouldRestoreKeyboardRef.current = true;
        return;
      }
      shouldRestoreKeyboardRef.current = pickerLiftFrozen.value > 0;
      return;
    }
    shouldRestoreKeyboardRef.current = androidKeyboardInset.value > 1;
  }, [androidKeyboardInset, iosKeyboardLift, heldKeyboardInset, pickerLiftFrozen]);

  const freezeComposerLift = useCallback(() => {
    if (Platform.OS !== "ios") return;
    const snap = snapshotComposerLift(iosKeyboardLift.value, heldKeyboardInset.value);
    if (snap > 1) {
      frozenComposerLift.value = snap;
      heldKeyboardInset.value = snap;
    }
  }, [frozenComposerLift, heldKeyboardInset, iosKeyboardLift]);

  const clearComposerFreeze = useCallback(() => {
    if (Platform.OS !== "ios") return;
    frozenComposerLift.value = 0;
  }, [frozenComposerLift]);

  const beginComposerInteraction = useCallback(() => {
    freezeComposerLift();
    captureRestoreIntent();
    composerInteractionLock.value += 1;
    composerInteractionLockJsRef.current += 1;
  }, [captureRestoreIntent, composerInteractionLock, freezeComposerLift]);

  const beginPickerInteraction = useCallback(() => {
    freezeComposerLift();
    captureRestoreIntent();
    if (Platform.OS === "ios") {
      pickerLiftFrozen.value = 1;
    }
    composerInteractionLock.value += 1;
    composerInteractionLockJsRef.current += 1;
  }, [captureRestoreIntent, composerInteractionLock, freezeComposerLift, pickerLiftFrozen]);

  const endComposerInteraction = useCallback(
    (refocusInput?: () => void) => {
      const release = () => {
        composerInteractionLock.value = Math.max(0, composerInteractionLock.value - 1);
        composerInteractionLockJsRef.current = Math.max(0, composerInteractionLockJsRef.current - 1);
        if (composerInteractionLockJsRef.current === 0) {
          clearComposerFreeze();
        }
      };

      const finalize = () => {
        if (!shouldRestoreKeyboardRef.current && Platform.OS === "ios") {
          heldKeyboardInset.value = 0;
        }
        release();
      };

      if (shouldRestoreKeyboardRef.current) {
        refocusInput?.();
        setTimeout(() => {
          if (Platform.OS === "ios") {
            recalculateIosKeyboardLift();
          }
          finalize();
        }, 120);
        return;
      }

      finalize();
    },
    [clearComposerFreeze, composerInteractionLock, heldKeyboardInset, recalculateIosKeyboardLift],
  );

  const endPickerInteraction = useCallback(
    (refocusInput?: () => void) => {
      if (Platform.OS === "ios") {
        pickerLiftFrozen.value = 0;
      }
      endComposerInteraction(refocusInput);
    },
    [endComposerInteraction, pickerLiftFrozen],
  );

  const isComposerInteractionLocked = useCallback(() => composerInteractionLockJsRef.current > 0, []);

  const runWithComposerKeyboardLock = useCallback(
    (action: () => void | Promise<void>, refocusInput?: () => void) => {
      beginComposerInteraction();
      try {
        const result = action();
        if (result != null && typeof (result as Promise<void>).finally === "function") {
          void (result as Promise<void>).finally(() => {
            endComposerInteraction(refocusInput);
          });
          return;
        }
        endComposerInteraction(refocusInput);
      } catch {
        endComposerInteraction(refocusInput);
      }
    },
    [beginComposerInteraction, endComposerInteraction],
  );

  return {
    effectiveInset,
    recalculateIosKeyboardLift,
    beginComposerInteraction,
    beginPickerInteraction,
    endComposerInteraction,
    endPickerInteraction,
    isComposerInteractionLocked,
    runWithComposerKeyboardLock,
  };
}
