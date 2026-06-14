import { AppPressable } from "@/shared/ui/app-pressable";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "@/app/providers/ThemeProvider";

type Props = {
  venueName: string;
  onOpen: () => void;
  onDismiss: () => void;
};

export function BookingConfirmedBanner({ venueName, onOpen, onDismiss }: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  return (
    <View style={[styles.wrap, { backgroundColor: "#DCFCE7", borderColor: "#86EFAC" }]}>
      <Ionicons name="checkmark-circle" size={22} color="#166534" />
      <View style={styles.body}>
        <Text style={[styles.title, { color: "#166534" }]}>{t("bookings.venueConfirmedBannerTitle")}</Text>
        <Text style={[styles.message, { color: colors.text }]}>
          {t("bookings.venueConfirmedBannerBody", { venueName })}
        </Text>
        <AppPressable style={[styles.actionBtn, { backgroundColor: "#166534" }]} onPress={onOpen}>
          <Text style={styles.actionBtnText}>{t("bookings.venueConfirmedBannerAction")}</Text>
        </AppPressable>
      </View>
      <AppPressable
        accessibilityRole="button"
        accessibilityLabel={t("bookings.venueConfirmedBannerDismissA11y")}
        onPress={onDismiss}
        hitSlop={8}
      >
        <Ionicons name="close" size={20} color={colors.textMuted} />
      </AppPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionBtn: {
    alignSelf: "flex-start",
    marginTop: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
});
