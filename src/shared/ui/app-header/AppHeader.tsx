import { memo, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { useUnreadCount } from "@/entities/notification";
import { LanguagePickerModal } from "@/shared/ui/app-header/LanguagePickerModal";
import { NotificationsSheetModal } from "@/shared/ui/notifications-sheet";

type AppHeaderProps = {
  title: string;
  leftIcon: keyof typeof Ionicons.glyphMap;
  onLeftPress: () => void;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightPress?: () => void;
  /**
   * When true, header shows a bell that opens an in-header notifications sheet.
   * Omit if you use `onNotificationsPress` and host `NotificationsSheetModal` yourself (e.g. Profile menu row).
   */
  notificationsEnabled?: boolean;
  /** Bell tap handler; if set, header does not mount its own notifications sheet. */
  onNotificationsPress?: () => void;
};

function AppHeaderComponent({
  title,
  leftIcon,
  onLeftPress,
  rightIcon,
  onRightPress,
  notificationsEnabled = false,
  onNotificationsPress,
}: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const [languageOpen, setLanguageOpen] = useState(false);
  const [internalNotificationsOpen, setInternalNotificationsOpen] = useState(false);
  const hasRightAction = Boolean(rightIcon && onRightPress);
  const unread = useUnreadCount();

  const showNotificationsBell = notificationsEnabled || Boolean(onNotificationsPress);
  const useInternalNotificationsSheet = notificationsEnabled && !onNotificationsPress;

  /** Pixel widths from screen edges so the title stays visually centered (symmetric insets). */
  const { titleInsetLeft, titleInsetRight } = useMemo(() => {
    const pad = 12;
    const btn = 34;
    const gap = 6;
    const leftCluster = pad + btn + (showNotificationsBell ? gap + btn : 0);
    const rightCluster = pad + btn + gap + (hasRightAction ? btn : 0);
    const symmetric = Math.max(leftCluster, rightCluster);
    return { titleInsetLeft: symmetric, titleInsetRight: symmetric };
  }, [showNotificationsBell, hasRightAction]);

  const openNotifications = () => {
    if (onNotificationsPress) onNotificationsPress();
    else setInternalNotificationsOpen(true);
  };

  return (
    <View style={[styles.wrap, { paddingTop: Math.max(insets.top, 10), borderBottomColor: colors.border, backgroundColor: colors.background }]}>
      <View style={styles.row}>
        <View style={styles.leftActions}>
          <Pressable style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={onLeftPress}>
            <Ionicons name={leftIcon} size={20} color={colors.text} />
          </Pressable>
          {showNotificationsBell ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("notifications.openA11y")}
              style={[styles.iconBtn, styles.bellWrap, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={openNotifications}
            >
              <Ionicons name="notifications-outline" size={20} color={colors.text} />
              {unread > 0 ? (
                <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.badgeText, { color: colors.onPrimary }]}>{unread > 9 ? "9+" : String(unread)}</Text>
                </View>
              ) : null}
            </Pressable>
          ) : null}
        </View>
        <Text
          style={[styles.title, { color: colors.text, left: titleInsetLeft, right: titleInsetRight }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <View style={styles.rightActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("language.choose")}
            style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={() => setLanguageOpen(true)}
          >
            <Ionicons name="language-outline" size={20} color={colors.text} />
          </Pressable>
          {hasRightAction ? (
            <Pressable style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={onRightPress}>
              <Ionicons name={rightIcon} size={20} color={colors.text} />
            </Pressable>
          ) : null}
        </View>
      </View>
      <LanguagePickerModal visible={languageOpen} onClose={() => setLanguageOpen(false)} />
      {useInternalNotificationsSheet ? (
        <NotificationsSheetModal
          visible={internalNotificationsOpen}
          onClose={() => setInternalNotificationsOpen(false)}
        />
      ) : null}
    </View>
  );
}

export const AppHeader = memo(AppHeaderComponent);

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  row: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  leftActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    zIndex: 1,
  },
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    zIndex: 1,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  bellWrap: {
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  title: {
    position: "absolute",
    textAlign: "center",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
});
