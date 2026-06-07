import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import { useVenueLiveCrowd } from "@/entities/venue-crowd";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { ShimmerProvider, ShimmerSurface } from "@/shared/ui/shimmer";
import { getCrowdPresentation } from "../lib/crowdPresentation";

type Props = {
  venueId: string;
  enabled?: boolean;
  onCheckIn?: () => void;
  onCardPress?: () => void;
  isCheckingIn?: boolean;
  style?: StyleProp<ViewStyle>;
  crowdCardStyle?: StyleProp<ViewStyle>;
  crowdBadgeStyle?: StyleProp<ViewStyle>;
  crowdTitleStyle?: StyleProp<TextStyle>;
  crowdHeadlineStyle?: StyleProp<TextStyle>;
  crowdMetaStyle?: StyleProp<TextStyle>;
  crowdCheckInBtnStyle?: StyleProp<ViewStyle>;
  crowdCheckInTextStyle?: StyleProp<TextStyle>;
};

export function LiveCrowdCard({
  venueId,
  enabled = true,
  onCheckIn,
  onCardPress,
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
  const renderCard = (children: ReactNode, accessibilityState?: { busy?: boolean }) => {
    const cardStyle = [style, crowdCardStyle];
    if (!onCardPress) {
      return <View style={cardStyle}>{children}</View>;
    }
    return (
      <Pressable
        style={cardStyle}
        onPress={onCardPress}
        accessibilityRole="button"
        accessibilityLabel={t("crowd.liveMeter")}
        accessibilityState={accessibilityState}
      >
        {children}
      </Pressable>
    );
  };

  if (isLoading && !data) {
    return (
      <ShimmerProvider active>
        {renderCard(
          <>
            <View style={crowdBadgeStyle}>
              <ShimmerSurface width={112} height={16} borderRadius={8} />
              <ShimmerSurface width={172} height={19} borderRadius={10} />
            </View>

            <ShimmerSurface width={132} height={15} borderRadius={8} style={{ marginTop: 6 }} />

            {onCheckIn ? (
              <View style={crowdCheckInBtnStyle}>
                <ShimmerSurface width={96} height={14} borderRadius={7} />
              </View>
            ) : null}
          </>,
          { busy: true },
        )}
      </ShimmerProvider>
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

  return renderCard(
    <>
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
    </>,
  );
}
