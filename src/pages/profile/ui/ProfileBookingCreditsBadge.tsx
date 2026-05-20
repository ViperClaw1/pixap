import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { BookingCreditsStatus } from "@/entities/booking-credits";
import { useProfileStyles } from "./profileStyles";

type Props = {
  balance: number;
  credits: BookingCreditsStatus | null | undefined;
};

export function ProfileBookingCreditsBadge({ balance, credits }: Props) {
  const { t } = useTranslation();
  const styles = useProfileStyles();

  const introDaysLeft =
    credits?.isIntroActive && credits.introPeriodEndsAt
      ? Math.max(
          0,
          Math.ceil((new Date(credits.introPeriodEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
        )
      : null;

  const label =
    credits?.isIntroActive && introDaysLeft != null
      ? t("bookingCredits.introBadge", { count: balance, days: introDaysLeft })
      : t("bookingCredits.balanceBadge", { count: balance });

  return (
    <View style={styles.bookingCreditsBadge}>
      <Text style={styles.bookingCreditsBadgeText} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}
