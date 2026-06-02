import { ActivityIndicator, Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import { useVenueLiveCrowd } from "@/entities/venue-crowd";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { getCrowdPresentation } from "../lib/crowdPresentation";

type Props = {
  venueId: string;
  enabled?: boolean;
  onCheckIn?: () => void;
  isCheckingIn?: boolean;
  style?: StyleProp<ViewStyle>;
  crowdCardStyle?: StyleProp<ViewStyle>;
  crowdBadgeStyle?: StyleProp<ViewStyle>;
  crowdTitleStyle?: StyleProp<ViewStyle>;
  crowdHeadlineStyle?: StyleProp<ViewStyle>;
  crowdMetaStyle?: StyleProp<ViewStyle>;
  crowdCheckInBtnStyle?: StyleProp<ViewStyle>;
  crowdCheckInTextStyle?: StyleProp<ViewStyle>;
};

export function LiveCrowdCard({
  venueId,
  enabled = true,
  onCheckIn,
  isCheckingIn = false,
  style,
  crowdCardStyle,
  crowdBadgeStyle,
  crowdTitleStyle,
  crowdHeadlineStyle,
  crowdMetaStyle,
  crowdCheckInBtnStyle,
  crowdCheckInTextStyle,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { data, isLoading, isError } = useVenueLiveCrowd(venueId, { enabled });

  if (isLoading && !data) {
    return (
      <View style={[style, crowdCardStyle]}>
        <ActivityIndicator size="small" />
      </View>
    );
  }

  if (isError && !data) {
    return null;
  }

  const crowd = data ?? {
    crowd_score: 0,
    crowd_level: "empty" as const,
    checkins_last_hour: 0,
    active_bookings: 0,
    stories_velocity: 0,
  };

  const presentation = getCrowdPresentation(crowd.crowd_level);

  return (
    <View style={[style, crowdCardStyle]}>
      <View style={crowdBadgeStyle}>
        <Text style={crowdTitleStyle}>
          {presentation.emoji} {t("crowd.liveMeter")}
        </Text>
        <Text style={[crowdHeadlineStyle, { color: presentation.accentColor }]}>
          {t(presentation.headlineKey)}
        </Text>
      </View>

      <Text style={crowdMetaStyle}>
        {t(presentation.levelKey)} · {t("crowd.score", { score: crowd.crowd_score })}
      </Text>

      {onCheckIn ? (
        <Pressable
          style={[crowdCheckInBtnStyle, isCheckingIn && { opacity: 0.65 }]}
          onPress={onCheckIn}
          disabled={isCheckingIn}
          accessibilityRole="button"
          accessibilityLabel={t("crowd.checkInCta")}
          accessibilityState={{ disabled: isCheckingIn, busy: isCheckingIn }}
        >
          {isCheckingIn ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <Text style={crowdCheckInTextStyle}>{t("crowd.checkInCta")}</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}
