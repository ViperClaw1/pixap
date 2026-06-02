import { Ionicons } from "@expo/vector-icons";
import { CategoryIcon } from "@/entities/category";
import { AppPressable } from "@/shared/ui/app-pressable";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector, ScrollView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import type { BookingRequestHistoryItem } from "../lib/buildHistoryItem";

const OPEN_MS = 280;
const CLOSE_MS = 340;
const CLOSE_MIN_MS = 120;
const CLOSE_EASING = Easing.bezier(0.32, 0.72, 0, 1);

type Props = {
  visible: boolean;
  items: BookingRequestHistoryItem[];
  activeTabId: string | null;
  onClose: () => void;
  onSelectTab: (tabId: string) => void;
  onNewRequest: () => void;
};

export function BookingRequestHistoryDrawer({
  visible,
  items,
  activeTabId,
  onClose,
  onSelectTab,
  onNewRequest,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(width * 0.82, 340);
  const [mounted, setMounted] = useState(visible);
  const isClosingRef = useRef(false);
  const translateX = useSharedValue(-panelWidth);
  const panStartX = useSharedValue(0);

  const finishClose = useCallback(() => {
    isClosingRef.current = false;
    setMounted(false);
    onClose();
  }, [onClose]);

  const animateClose = useCallback(
    (fromX?: number) => {
      if (isClosingRef.current) return;
      isClosingRef.current = true;

      const startX = fromX ?? translateX.value;
      const remaining = Math.max(0, -panelWidth - startX);
      if (remaining <= 0.5) {
        translateX.value = -panelWidth;
        finishClose();
        return;
      }

      cancelAnimation(translateX);
      const duration = Math.max(CLOSE_MIN_MS, Math.round((remaining / panelWidth) * CLOSE_MS));
      translateX.value = withTiming(
        -panelWidth,
        { duration, easing: CLOSE_EASING },
        (finished) => {
          if (finished) runOnJS(finishClose)();
        },
      );
    },
    [finishClose, panelWidth, translateX],
  );

  useEffect(() => {
    if (!visible) return;
    isClosingRef.current = false;
    setMounted(true);
    cancelAnimation(translateX);
    translateX.value = withTiming(0, {
      duration: OPEN_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [panelWidth, translateX, visible]);

  const handlePanEnd = useCallback(
    (offsetX: number, velocityX: number) => {
      const threshold = panelWidth * 0.28;
      if (offsetX < -threshold || velocityX < -500) {
        animateClose(offsetX);
        return;
      }
      translateX.value = withSpring(0, { damping: 26, stiffness: 240, mass: 0.9 });
    },
    [animateClose, panelWidth, translateX],
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(visible)
        .activeOffsetX([-12, 12])
        .failOffsetY([-14, 14])
        .onStart(() => {
          panStartX.value = translateX.value;
        })
        .onUpdate((event) => {
          const next = panStartX.value + event.translationX;
          translateX.value = Math.min(0, Math.max(-panelWidth, next));
        })
        .onEnd((event) => {
          runOnJS(handlePanEnd)(translateX.value, event.velocityX);
        }),
    [handlePanEnd, panelWidth, panStartX, translateX, visible],
  );

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-panelWidth, 0], [0, 0.45], Extrapolation.CLAMP),
  }));

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  if (!mounted) return null;

  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFillObject, styles.overlay]}>
      <Animated.View
        pointerEvents={visible ? "auto" : "none"}
        style={[StyleSheet.absoluteFillObject, styles.backdrop, backdropStyle]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("aiBooking.closeHistoryA11y")}
          onPress={() => animateClose()}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      <GestureDetector gesture={panGesture}>
        <Animated.View
          pointerEvents={visible ? "auto" : "none"}
          style={[
            styles.panel,
            {
              width: panelWidth,
              paddingTop: insets.top + 12,
              paddingBottom: insets.bottom + 12,
              backgroundColor: colors.card,
              borderRightColor: colors.border,
            },
            panelStyle,
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {t("aiBooking.requestHistoryTitle")}
            </Text>
            <AppPressable
              accessibilityRole="button"
              accessibilityLabel={t("aiBooking.newRequestA11y")}
              onPress={() => {
                onNewRequest();
                animateClose();
              }}
              style={[styles.newRequestBtn, { borderColor: colors.border }]}
            >
              <Ionicons name="add" size={22} color={colors.primary} />
            </AppPressable>
          </View>

          <ScrollView contentContainerStyle={styles.listContent}>
            {items.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {t("aiBooking.requestHistoryEmpty")}
              </Text>
            ) : (
              items.map((item) => {
                const active = item.tabId === activeTabId;
                return (
                  <AppPressable
                    key={item.tabId}
                    onPress={() => {
                      onSelectTab(item.tabId);
                      animateClose();
                    }}
                    style={[
                      styles.historyRow,
                      {
                        borderBottomColor: colors.border,
                        backgroundColor: active ? colors.background : "transparent",
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.historyIconWrap,
                        { backgroundColor: `${item.iconTint}33` },
                      ]}
                    >
                      <CategoryIcon spec={item.iconSpec} size={18} color={item.iconTint} />
                    </View>
                    <View style={styles.historyTextCol}>
                      <Text style={[styles.historyTitle, { color: colors.text }]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={[styles.historySubtitle, { color: colors.textMuted }]} numberOfLines={2}>
                        {item.subtitle}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </AppPressable>
                );
              })
            )}
          </ScrollView>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    zIndex: 50,
  },
  backdrop: {
    backgroundColor: "#000000",
  },
  panel: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRightWidth: 1,
    zIndex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  headerTitle: {
    fontWeight: "800",
    fontSize: 18,
  },
  newRequestBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: 12,
  },
  emptyText: {
    paddingHorizontal: 4,
    paddingVertical: 16,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderRadius: 10,
  },
  historyIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  historyTextCol: {
    flex: 1,
    minWidth: 0,
  },
  historyTitle: {
    fontWeight: "700",
    fontSize: 15,
  },
  historySubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});
