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

  // Balance is numeric(10,2) now (0.1–0.25 route-build charges, 0.25–0.5 AI chat turns), so
  // display it rounded to 1 decimal and only show that decimal when it's non-zero.
  const displayBalance = Math.round(balance * 10) / 10;
  const isLastCredit = balance > 0 && balance < 1;

  const showIntroBadge = isIntroActive && !hasPaidPremium;

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
        : t("bookingCredits.introBadge", { count: displayBalance, days: introDaysLeft })
      : t("bookingCredits.balanceBadge", { count: displayBalance });

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
