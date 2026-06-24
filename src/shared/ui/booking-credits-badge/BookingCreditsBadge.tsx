import { Text, View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { resolveBookingCreditsBadgeSurface, resolveBookingCreditsBadgeUrgentSurface } from "./bookingCreditsBadgeTheme";

type Props = {
  balance: number;
  isIntroActive?: boolean;
  hasPaidPremium?: boolean;
  introPeriodEndsAt?: string | null;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function BookingCreditsBadge({
  balance,
  isIntroActive,
  hasPaidPremium,
  introPeriodEndsAt,
  compact,
  style,
}: Props) {
  const { t } = useTranslation();
  const { colors, isDark } = useAppTheme();

  const showIntroBadge = isIntroActive && !hasPaidPremium;
  const isLastCredit = showIntroBadge && balance === 1;

  const surface = isLastCredit
    ? resolveBookingCreditsBadgeUrgentSurface(colors)
    : resolveBookingCreditsBadgeSurface(colors, isDark);

  const introDaysLeft =
    showIntroBadge && introPeriodEndsAt
      ? Math.max(0, Math.ceil((new Date(introPeriodEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : null;

  const label =
    showIntroBadge && introDaysLeft != null
      ? isLastCredit
        ? t("bookingCredits.introBadgeLast", { days: introDaysLeft })
        : t("bookingCredits.introBadge", { count: balance, days: introDaysLeft })
      : t("bookingCredits.balanceBadge", { count: balance });

  return (
    <View
      style={[
        styles.wrap,
        compact && styles.wrapCompact,
        {
          backgroundColor: surface.backgroundColor,
          borderColor: surface.borderColor,
        },
        style,
      ]}
    >
      <Text style={[styles.text, { color: surface.textColor }]} numberOfLines={compact ? 1 : 2}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  wrapCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: "700",
  },
});
