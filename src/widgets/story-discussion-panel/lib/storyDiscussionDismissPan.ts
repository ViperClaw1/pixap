import { useCallback, useEffect, useMemo, useState } from "react";
import { Keyboard, Platform } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { animateStoryViewerDismissWorklet } from "@/shared/lib/storyViewerDismissAnimation";

/** Min downward drag (px) before dismiss — aligned with StoryViewerPage. */
export const STORY_DISCUSSION_DISMISS_DRAG_PX = 100;

export type StoryDiscussionDismissDragHandlers = {
  onDismissDragStart?: () => void;
  onDismissDragUpdate?: (translationY: number) => void;
  onDismissDragEnd?: (translationY: number, velocityY: number) => void;
};

export function useStoryDiscussionKeyboardOpen() {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardOpen(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardOpen(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return keyboardOpen;
}

export function useStoryDiscussionDismissPan(options: {
  enabled: boolean;
  dismissHeight: number;
  onClose?: () => void;
  dragHandlers?: StoryDiscussionDismissDragHandlers;
}) {
  const { enabled, dismissHeight, onClose, dragHandlers } = options;
  const keyboardOpen = useStoryDiscussionKeyboardOpen();
  const dismissTranslateY = useSharedValue(0);
  const usesExternalDrag = Boolean(
    dragHandlers?.onDismissDragStart ||
      dragHandlers?.onDismissDragUpdate ||
      dragHandlers?.onDismissDragEnd,
  );

  const finishLocalDismiss = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const handleLocalDragEnd = useCallback(
    (translationY: number, velocityY: number) => {
      const shouldClose =
        translationY > STORY_DISCUSSION_DISMISS_DRAG_PX ||
        (translationY > 48 && velocityY > 700);
      if (shouldClose && onClose) {
        animateStoryViewerDismissWorklet(
          dismissTranslateY,
          dismissHeight,
          translationY,
          velocityY,
          finishLocalDismiss,
        );
        return;
      }
      dismissTranslateY.value = withSpring(0, { damping: 18, stiffness: 200 });
    },
    [dismissHeight, dismissTranslateY, finishLocalDismiss, onClose],
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled && !keyboardOpen)
        .activeOffsetY(8)
        .failOffsetX([-28, 28])
        .onStart(() => {
          if (dragHandlers?.onDismissDragStart) {
            runOnJS(dragHandlers.onDismissDragStart)();
          }
        })
        .onUpdate((e) => {
          if (e.translationY <= 0 || Math.abs(e.translationY) <= Math.abs(e.translationX)) {
            return;
          }
          if (dragHandlers?.onDismissDragUpdate) {
            runOnJS(dragHandlers.onDismissDragUpdate)(e.translationY);
            return;
          }
          dismissTranslateY.value = e.translationY;
        })
        .onEnd((e) => {
          const isVertical = Math.abs(e.translationY) > Math.abs(e.translationX);
          if (!isVertical || e.translationY <= 0) {
            if (!usesExternalDrag) {
              dismissTranslateY.value = withSpring(0, { damping: 18, stiffness: 200 });
            }
            return;
          }
          if (dragHandlers?.onDismissDragEnd) {
            runOnJS(dragHandlers.onDismissDragEnd)(e.translationY, e.velocityY);
            return;
          }
          runOnJS(handleLocalDragEnd)(e.translationY, e.velocityY);
        }),
    [
      dismissTranslateY,
      dragHandlers,
      enabled,
      handleLocalDragEnd,
      keyboardOpen,
      usesExternalDrag,
    ],
  );

  const dismissDragStyle = useAnimatedStyle(() => {
    if (usesExternalDrag) {
      return {};
    }
    return {
      transform: [{ translateY: dismissTranslateY.value }],
    };
  });

  return {
    panGesture,
    dismissDragStyle,
    dismissTranslateY: usesExternalDrag ? undefined : dismissTranslateY,
  };
}
