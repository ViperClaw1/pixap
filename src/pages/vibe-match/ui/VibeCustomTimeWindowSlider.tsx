import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { formatVibeMinutesLabel } from "@/entities/pixai/lib/vibeBookingWindow";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import type { VibeCustomTimeWindow } from "../lib/vibeTimeSelection";
import {
  customWindowsEqual,
  formatCustomWindowEdgeLabel,
  useCustomTimeWindowAxis,
} from "../lib/customTimeWindowAxis";

export type { VibeCustomTimeWindow };

const THUMB_SIZE = 24;
const TRACK_HEIGHT = 6;

type Props = {
  value: VibeCustomTimeWindow;
  onChange: (value: VibeCustomTimeWindow) => void;
  disabled?: boolean;
};

type DragPreview = {
  thumb: "start" | "end";
  x: number;
};

export function VibeCustomTimeWindowSlider({ value, onChange, disabled = false }: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const axis = useCustomTimeWindowAxis();
  const { minStep: MIN_STEP, maxStep: MAX_STEP, minStepGap: MIN_STEP_GAP } = axis;
  const [trackWidth, setTrackWidth] = useState(0);
  const normalizedValue = useMemo(() => axis.normalizeCustomTimeWindow(value), [axis, value]);
  const [localWindow, setLocalWindow] = useState(normalizedValue);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const isDraggingRef = useRef(false);
  const localWindowRef = useRef(normalizedValue);
  const panAnchorStepsRef = useRef({ start: MIN_STEP, end: MAX_STEP });
  const axisRef = useRef(axis);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  }, []);

  const usableWidth = Math.max(0, trackWidth - THUMB_SIZE);

  useEffect(() => {
    axisRef.current = axis;
  }, [axis]);

  useEffect(() => {
    localWindowRef.current = localWindow;
  }, [localWindow]);

  useEffect(() => {
    if (isDraggingRef.current) return;
    const next = axis.normalizeCustomTimeWindow(value);
    setLocalWindow(next);
    localWindowRef.current = next;
    if (!disabled && !customWindowsEqual(next, value)) {
      onChange(next);
    }
  }, [axis, disabled, onChange, value]);

  const commitLocalWindow = useCallback(
    (nextWindow: VibeCustomTimeWindow) => {
      const normalized = axisRef.current.normalizeCustomTimeWindow(nextWindow);
      isDraggingRef.current = false;
      setDragPreview(null);
      setLocalWindow(normalized);
      localWindowRef.current = normalized;
      if (!customWindowsEqual(normalized, value)) {
        onChange(normalized);
      }
    },
    [onChange, value],
  );

  const beginThumbPan = useCallback((_thumb: "start" | "end") => {
    isDraggingRef.current = true;
    const currentAxis = axisRef.current;
    panAnchorStepsRef.current = {
      start: currentAxis.minutesToSliderStep(localWindowRef.current.startMinutes),
      end: currentAxis.minutesToSliderStep(localWindowRef.current.endMinutes),
    };
  }, []);

  const updateThumbPan = useCallback(
    (thumb: "start" | "end", translationX: number) => {
      const currentAxis = axisRef.current;
      const { start: anchorStart, end: anchorEnd } = panAnchorStepsRef.current;
      const anchorX = currentAxis.sliderStepToX(
        thumb === "start" ? anchorStart : anchorEnd,
        usableWidth,
      );
      const nextX = Math.max(0, Math.min(usableWidth, anchorX + translationX));
      setDragPreview({ thumb, x: nextX });
    },
    [usableWidth],
  );

  const finishThumbPan = useCallback(
    (thumb: "start" | "end", translationX: number) => {
      const currentAxis = axisRef.current;
      const { start: anchorStart, end: anchorEnd } = panAnchorStepsRef.current;
      const anchorX = currentAxis.sliderStepToX(
        thumb === "start" ? anchorStart : anchorEnd,
        usableWidth,
      );
      const nextStep = currentAxis.xToSliderStep(anchorX + translationX, usableWidth);
      const current = localWindowRef.current;
      const currentStart = currentAxis.minutesToSliderStep(current.startMinutes);
      const currentEnd = currentAxis.minutesToSliderStep(current.endMinutes);

      const nextWindow =
        thumb === "start"
          ? {
              startMinutes: currentAxis.sliderStepToMinutes(Math.min(nextStep, currentEnd - MIN_STEP_GAP)),
              endMinutes: current.endMinutes,
            }
          : {
              startMinutes: current.startMinutes,
              endMinutes: currentAxis.sliderStepToMinutes(Math.max(nextStep, currentStart + MIN_STEP_GAP)),
            };

      commitLocalWindow(nextWindow);
    },
    [MIN_STEP_GAP, commitLocalWindow, usableWidth],
  );

  const handleTrackTap = useCallback(
    (x: number) => {
      const currentAxis = axisRef.current;
      const currentStart = currentAxis.minutesToSliderStep(localWindowRef.current.startMinutes);
      const currentEnd = currentAxis.minutesToSliderStep(localWindowRef.current.endMinutes);
      const tappedStep = currentAxis.xToSliderStep(x, usableWidth);
      const distToStart = Math.abs(tappedStep - currentStart);
      const distToEnd = Math.abs(tappedStep - currentEnd);
      const nextWindow =
        distToStart <= distToEnd
          ? {
              startMinutes: currentAxis.sliderStepToMinutes(Math.min(tappedStep, currentEnd - MIN_STEP_GAP)),
              endMinutes: currentAxis.sliderStepToMinutes(currentEnd),
            }
          : {
              startMinutes: currentAxis.sliderStepToMinutes(currentStart),
              endMinutes: currentAxis.sliderStepToMinutes(Math.max(tappedStep, currentStart + MIN_STEP_GAP)),
            };

      const normalized = currentAxis.normalizeCustomTimeWindow(nextWindow);
      setLocalWindow(normalized);
      localWindowRef.current = normalized;
      if (!customWindowsEqual(normalized, value)) {
        onChange(normalized);
      }
    },
    [MIN_STEP_GAP, onChange, usableWidth, value],
  );

  const makeThumbGesture = useCallback(
    (thumb: "start" | "end") =>
      Gesture.Pan()
        .onBegin(() => {
          runOnJS(beginThumbPan)(thumb);
        })
        .onUpdate((event) => {
          runOnJS(updateThumbPan)(thumb, event.translationX);
        })
        .onFinalize((event) => {
          runOnJS(finishThumbPan)(thumb, event.translationX);
        }),
    [beginThumbPan, finishThumbPan, updateThumbPan],
  );

  const startGesture = useMemo(() => makeThumbGesture("start"), [makeThumbGesture]);
  const endGesture = useMemo(() => makeThumbGesture("end"), [makeThumbGesture]);

  const trackGesture = useMemo(
    () =>
      Gesture.Tap().onEnd((event) => {
        runOnJS(handleTrackTap)(event.x - THUMB_SIZE / 2);
      }),
    [handleTrackTap],
  );

  const startStep = axis.minutesToSliderStep(localWindow.startMinutes);
  const endStep = axis.minutesToSliderStep(localWindow.endMinutes);
  const startX =
    dragPreview?.thumb === "start" ? dragPreview.x : axis.sliderStepToX(startStep, usableWidth);
  const endX = dragPreview?.thumb === "end" ? dragPreview.x : axis.sliderStepToX(endStep, usableWidth);
  const previewStartStep =
    dragPreview?.thumb === "start" ? axis.xToSliderStep(dragPreview.x, usableWidth) : startStep;
  const previewEndStep =
    dragPreview?.thumb === "end" ? axis.xToSliderStep(dragPreview.x, usableWidth) : endStep;
  const previewStartMinutes = axis.sliderStepToMinutes(
    dragPreview?.thumb === "start"
      ? Math.min(previewStartStep, endStep - MIN_STEP_GAP)
      : startStep,
  );
  const previewEndMinutes = axis.sliderStepToMinutes(
    dragPreview?.thumb === "end"
      ? Math.max(previewEndStep, startStep + MIN_STEP_GAP)
      : endStep,
  );
  const rangeLeft = startX + THUMB_SIZE / 2;
  const rangeWidth = Math.max(0, endX - startX);

  return (
    <View style={[styles.wrap, disabled && styles.disabled]}>
      <Text style={[styles.rangeLabel, { color: colors.text }]}>
        {t("vibeMatch.customTimeRange", {
          start: formatVibeMinutesLabel(previewStartMinutes),
          end: formatCustomWindowEdgeLabel(previewEndMinutes),
        })}
      </Text>
      <View style={styles.trackWrap} onLayout={onLayout}>
        <GestureDetector gesture={trackGesture}>
          <View style={[styles.track, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.rangeFill,
                {
                  left: rangeLeft,
                  width: rangeWidth,
                  backgroundColor: colors.primary,
                },
              ]}
            />
          </View>
        </GestureDetector>
        <GestureDetector gesture={startGesture}>
          <View
            style={[
              styles.thumb,
              {
                left: startX,
                backgroundColor: colors.background,
                borderColor: colors.primary,
              },
            ]}
            accessibilityRole="adjustable"
            accessibilityLabel={t("vibeMatch.customWindowStartA11y", {
              time: formatVibeMinutesLabel(previewStartMinutes),
            })}
          />
        </GestureDetector>
        <GestureDetector gesture={endGesture}>
          <View
            style={[
              styles.thumb,
              {
                left: endX,
                backgroundColor: colors.background,
                borderColor: colors.primary,
              },
            ]}
            accessibilityRole="adjustable"
            accessibilityLabel={t("vibeMatch.customWindowEndA11y", {
              time: formatCustomWindowEdgeLabel(previewEndMinutes),
            })}
          />
        </GestureDetector>
      </View>
      <View style={styles.edgeLabels}>
        <Text style={[styles.edgeLabel, { color: colors.textMuted }]}>
          {formatCustomWindowEdgeLabel(axis.minMinutes)}
        </Text>
        <Text style={[styles.edgeLabel, { color: colors.textMuted }]}>
          {formatCustomWindowEdgeLabel(axis.maxMinutes)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginTop: 4 },
  disabled: { opacity: 0.45 },
  rangeLabel: { fontSize: 14, fontWeight: "700", textAlign: "center" },
  trackWrap: {
    height: THUMB_SIZE,
    justifyContent: "center",
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    overflow: "hidden",
  },
  rangeFill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    borderRadius: TRACK_HEIGHT / 2,
  },
  thumb: {
    position: "absolute",
    top: 0,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 2,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  edgeLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  edgeLabel: { fontSize: 11, fontWeight: "600" },
});
