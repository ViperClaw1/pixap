import { useStaticWindowSize } from "@/shared/lib/useStaticWindowSize";
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const ENTER_DURATION_MS = 300;
const EXIT_DURATION_MS = 220;
const SWIPE_COMMIT_RATIO = 0.22;
const SWIPE_VELOCITY = 420;
const RUBBER_BAND = 0.32;
const SLIDE_EASING = Easing.bezier(0.4, 0, 0.2, 1);

type OutgoingPane = {
  key: string;
  content: ReactNode;
};

type Props = {
  stepKey: string;
  /** 1 = forward (enter from right), -1 = back (enter from left) */
  direction: 1 | -1;
  canSwipeForward: boolean;
  canSwipeBack: boolean;
  enableSwipe?: boolean;
  onSwipeForward: () => void;
  onSwipeBack: () => void;
  /** Swipe-back uses the same enter animation as a header back tap (no drag offset). */
  instantBackOnSwipe?: boolean;
  /** Forward step change uses stack push slide (outgoing left + incoming from right). */
  stackSlideForward?: boolean;
  children: ReactNode;
};

export function OnboardingStepTransition({
  stepKey,
  direction,
  canSwipeForward,
  canSwipeBack,
  enableSwipe = true,
  onSwipeForward,
  onSwipeBack,
  instantBackOnSwipe = false,
  stackSlideForward = false,
  children,
}: Props) {
  const { width } = useStaticWindowSize();
  const translateX = useSharedValue(0);
  const incomingTranslateX = useSharedValue(0);
  const outgoingTranslateX = useSharedValue(0);
  const isExiting = useSharedValue(false);
  const isStackTransitioning = useSharedValue(false);
  const mountedStepRef = useRef<string | null>(null);
  const prevChildrenRef = useRef<ReactNode>(children);
  const widthSv = useSharedValue(width);
  const canSwipeBackSv = useSharedValue(canSwipeBack);
  const canSwipeForwardSv = useSharedValue(canSwipeForward);
  const instantBackOnSwipeSv = useSharedValue(instantBackOnSwipe);
  const onSwipeForwardRef = useRef(onSwipeForward);
  const onSwipeBackRef = useRef(onSwipeBack);
  const [outgoingPane, setOutgoingPane] = useState<OutgoingPane | null>(null);

  const clearOutgoingPane = useCallback(() => {
    setOutgoingPane(null);
    isStackTransitioning.value = false;
    incomingTranslateX.value = 0;
    outgoingTranslateX.value = 0;
  }, [incomingTranslateX, isStackTransitioning, outgoingTranslateX]);

  useLayoutEffect(() => {
    widthSv.value = width;
  }, [width, widthSv]);

  useLayoutEffect(() => {
    canSwipeBackSv.value = canSwipeBack;
    canSwipeForwardSv.value = canSwipeForward;
    instantBackOnSwipeSv.value = instantBackOnSwipe;
  }, [canSwipeBack, canSwipeForward, instantBackOnSwipe, canSwipeBackSv, canSwipeForwardSv, instantBackOnSwipeSv]);

  useLayoutEffect(() => {
    onSwipeForwardRef.current = onSwipeForward;
    onSwipeBackRef.current = onSwipeBack;
  }, [onSwipeForward, onSwipeBack]);

  useLayoutEffect(() => {
    isExiting.value = false;
    if (mountedStepRef.current === null) {
      mountedStepRef.current = stepKey;
      translateX.value = 0;
      prevChildrenRef.current = children;
      return;
    }
    if (mountedStepRef.current === stepKey) {
      prevChildrenRef.current = children;
      return;
    }

    const previousKey = mountedStepRef.current;
    mountedStepRef.current = stepKey;

    cancelAnimation(translateX);
    cancelAnimation(incomingTranslateX);
    cancelAnimation(outgoingTranslateX);
    setOutgoingPane(null);
    isStackTransitioning.value = false;

    if (direction === 1 && stackSlideForward) {
      isStackTransitioning.value = true;
      setOutgoingPane({ key: previousKey, content: prevChildrenRef.current });
      translateX.value = 0;
      incomingTranslateX.value = width;
      outgoingTranslateX.value = 0;

      incomingTranslateX.value = withTiming(0, {
        duration: ENTER_DURATION_MS,
        easing: SLIDE_EASING,
      });
      outgoingTranslateX.value = withTiming(-width, {
        duration: ENTER_DURATION_MS,
        easing: SLIDE_EASING,
      }, (finished) => {
        if (finished) runOnJS(clearOutgoingPane)();
      });
      prevChildrenRef.current = children;
      return;
    }

    const from = direction * width;
    translateX.value = from;
    translateX.value = withTiming(0, {
      duration: ENTER_DURATION_MS,
      easing: SLIDE_EASING,
    });
    prevChildrenRef.current = children;
  }, [
    stepKey,
    direction,
    width,
    stackSlideForward,
    isExiting,
    translateX,
    incomingTranslateX,
    outgoingTranslateX,
    isStackTransitioning,
    clearOutgoingPane,
  ]);

  const invokeSwipeForward = () => {
    onSwipeForwardRef.current();
  };

  const invokeSwipeBack = () => {
    onSwipeBackRef.current();
  };

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enableSwipe)
        .activeOffsetX([-18, 18])
        .failOffsetY([-14, 14])
        .onUpdate((e) => {
          if (isExiting.value || isStackTransitioning.value) return;
          const tx = e.translationX;
          if (instantBackOnSwipeSv.value && tx > 0 && canSwipeBackSv.value) {
            return;
          }
          if (tx < 0 && !canSwipeForwardSv.value) {
            translateX.value = tx * RUBBER_BAND;
            return;
          }
          if (tx > 0 && !canSwipeBackSv.value) {
            translateX.value = tx * RUBBER_BAND;
            return;
          }
          translateX.value = tx;
        })
        .onEnd((e) => {
          if (isExiting.value || isStackTransitioning.value) return;
          const layoutWidth = widthSv.value;
          const threshold = layoutWidth * SWIPE_COMMIT_RATIO;
          const goForward =
            canSwipeForwardSv.value &&
            (e.translationX < -threshold || e.velocityX < -SWIPE_VELOCITY);
          const goBack =
            canSwipeBackSv.value &&
            (e.translationX > threshold || e.velocityX > SWIPE_VELOCITY);

          if (goForward) {
            isExiting.value = true;
            translateX.value = withTiming(-layoutWidth, { duration: EXIT_DURATION_MS }, (finished) => {
              if (finished) runOnJS(invokeSwipeForward)();
            });
            return;
          }
          if (goBack) {
            if (instantBackOnSwipeSv.value) {
              cancelAnimation(translateX);
              translateX.value = 0;
              isExiting.value = false;
              runOnJS(invokeSwipeBack)();
              return;
            }
            isExiting.value = true;
            translateX.value = withTiming(layoutWidth, { duration: EXIT_DURATION_MS }, (finished) => {
              if (finished) runOnJS(invokeSwipeBack)();
            });
            return;
          }
          translateX.value = withSpring(0, { damping: 20, stiffness: 280 });
        }),
    [
      enableSwipe,
      canSwipeBackSv,
      canSwipeForwardSv,
      instantBackOnSwipeSv,
      isExiting,
      isStackTransitioning,
      translateX,
      widthSv,
    ],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    flex: 1,
    transform: [{ translateX: translateX.value }],
  }));

  const incomingStackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: incomingTranslateX.value }],
  }));

  const outgoingStackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: outgoingTranslateX.value }],
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={styles.container}>
        {outgoingPane ? (
          <>
            <Animated.View style={[styles.stackPane, outgoingStackStyle]} pointerEvents="none">
              {outgoingPane.content}
            </Animated.View>
            <Animated.View style={[styles.stackPane, incomingStackStyle]}>{children}</Animated.View>
          </>
        ) : (
          <Animated.View style={[styles.pane, animatedStyle]}>{children}</Animated.View>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: "hidden" },
  pane: { flex: 1 },
  stackPane: { ...StyleSheet.absoluteFillObject, flex: 1 },
});
