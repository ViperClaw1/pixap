import { Ionicons } from "@expo/vector-icons";
import { CategoryIcon } from "@/entities/category";
import { AppPressable } from "@/shared/ui/app-pressable";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import type { BookingRequestHistoryItem } from "../lib/buildHistoryItem";

const OPEN_MS = 280;
const CLOSE_MS = 220;

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
  const progress = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = withTiming(1, {
        duration: OPEN_MS,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }
    if (!mounted) return;
    progress.value = withTiming(
      0,
      { duration: CLOSE_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(setMounted)(false);
      },
    );
  }, [visible, mounted, progress]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 0.45], Extrapolation.CLAMP),
  }));

  const panelStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(progress.value, [0, 1], [-panelWidth, 0], Extrapolation.CLAMP),
      },
    ],
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
          onPress={onClose}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

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
              onClose();
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
                    onClose();
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
