import { Text, View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/app/providers/ThemeProvider";

type Props = {
  balance: number;
  isIntroActive?: boolean;
  hasPaidPremium?: boolean;
  introPeriodEndsAt?: string | null;
  compact?: boolean;
};

export function BookingCreditsBadge({
  balance,
  isIntroActive,
  hasPaidPremium,
  introPeriodEndsAt,
  compact,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  const showIntroBadge = isIntroActive && !hasPaidPremium;

  const introDaysLeft =
    showIntroBadge && introPeriodEndsAt
      ? Math.max(0, Math.ceil((new Date(introPeriodEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : null;

  const label =
    showIntroBadge && introDaysLeft != null
      ? t("bookingCredits.introBadge", { count: balance, days: introDaysLeft })
      : t("bookingCredits.balanceBadge", { count: balance });

  return (
    <View
      style={[
        styles.wrap,
        compact && styles.wrapCompact,
        { backgroundColor: colors.accentSurface, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.text, { color: colors.text }]} numberOfLines={1}>
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
    borderWidth: StyleSheet.hairlineWidth,
  },
  wrapCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: "600",
  },
});
