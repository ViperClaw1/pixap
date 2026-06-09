import type { ReactNode } from "react";
import { Pressable, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import { useVenueLiveCrowd } from "@/entities/venue-crowd";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { ShimmerProvider, ShimmerSurface } from "@/shared/ui/shimmer";
import { getCrowdPresentation } from "../lib/crowdPresentation";
import { CrowdMeterBar } from "./CrowdMeterBar";
import { CrowdLivePulse } from "./CrowdLivePulse";
import { CrowdCheckInButton } from "./CrowdCheckInButton";

const TRENDING_VELOCITY_THRESHOLD = 2;

type Props = {
  venueId: string;
  enabled?: boolean;
  onCheckIn?: () => void;
  onCardPress?: () => void;
  isCheckingIn?: boolean;
  checkInRippleToken?: number;
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
  checkInRippleToken = 0,
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
            <ShimmerSurface width="100%" height={8} borderRadius={4} style={{ marginTop: 10 }} />
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
  const showLivePulse = crowd.crowd_level === "busy" || crowd.crowd_level === "packed";
  const isTrending = crowd.stories_velocity >= TRENDING_VELOCITY_THRESHOLD;

  return renderCard(
    <>
      <View style={crowdBadgeStyle}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Text style={crowdTitleStyle}>
            {presentation.emoji} {t("crowd.liveMeter")}
          </Text>
          {showLivePulse ? (
            <CrowdLivePulse color={presentation.accentColor} label={t("crowd.live", { defaultValue: "Live" })} />
          ) : null}
        </View>
        <Text style={[crowdHeadlineStyle, { color: presentation.accentColor }]}>
          {t(presentation.headlineKey)}
        </Text>
      </View>

      <CrowdMeterBar crowdLevel={crowd.crowd_level} trackColor={colors.border} />

      <Text style={crowdMetaStyle}>
        {crowd.checkins_last_hour > 0
          ? t("crowd.checkinsLastHour", {
              count: crowd.checkins_last_hour,
              defaultValue: "{{count}} people checked in this hour",
            })
          : `${t(presentation.levelKey)} · ${t("crowd.score", { score: crowd.crowd_score })}`}
      </Text>

      {isTrending ? (
        <View style={{ marginTop: 8, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: `${colors.primary}22` }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: colors.primary }}>
            {t("crowd.trending", { defaultValue: "Trending" })}
          </Text>
        </View>
      ) : null}

      {onCheckIn ? (
        <CrowdCheckInButton
          label={t("crowd.checkInCta")}
          onPress={onCheckIn}
          isCheckingIn={isCheckingIn}
          spinnerColor={colors.onPrimary}
          buttonStyle={crowdCheckInBtnStyle}
          textStyle={crowdCheckInTextStyle}
          rippleToken={checkInRippleToken}
        />
      ) : null}
    </>,
  );
}
