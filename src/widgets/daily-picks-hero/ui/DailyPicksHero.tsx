import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import type { DailyRecommendation } from "@/entities/daily-recommendation";
import { PLACE_IMAGE_FALLBACK } from "@/shared/assets/placeImageFallback";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { getPrimaryBusinessCardImage } from "@/shared/lib/business-card/businessCardImages";
import {
  businessCardDisplayFallback,
  getBusinessCardDisplayUrl,
} from "@/shared/lib/business-card/businessCardDisplayUrl";
import { HERO_OVERLAY_GRADIENT } from "@/shared/theme/gradients";
import { radii } from "@/shared/theme/radii";

export const DAILY_PICKS_HERO_HEIGHT = 220;

type Props = {
  recommendation: DailyRecommendation | null;
  onOpen: () => void;
};

export function DailyPicksHero({ recommendation, onOpen }: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  const heroRaw = recommendation ? getPrimaryBusinessCardImage(recommendation.images) : null;
  const heroUri = heroRaw
    ? getBusinessCardDisplayUrl(heroRaw, { size: "hero" })
    : null;

  return (
    <Pressable
      style={[styles.wrap, { borderColor: colors.border }]}
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={t("dailyRecommendations.openHero", { defaultValue: "Open daily recommendations" })}
    >
      {heroUri ? (
        <SmartImage
          uri={heroUri}
          fallbackUri={businessCardDisplayFallback(heroUri, heroRaw)}
          bundledFallback={PLACE_IMAGE_FALLBACK}
          recyclingKey={recommendation?.venue_id ?? "daily-picks-hero"}
          style={styles.image}
          contentFit="cover"
          showShimmerWhileLoading
        />
      ) : (
        <View style={[styles.image, { backgroundColor: colors.card }]} />
      )}

      <LinearGradient colors={[...HERO_OVERLAY_GRADIENT]} style={styles.gradient} pointerEvents="none" />

      <View style={styles.badge}>
        <Text style={styles.badgeText}>
          {t("dailyRecommendations.todaysPick")}
        </Text>
      </View>

      <View style={styles.content} pointerEvents="none">
        <Text style={styles.title}>
          {t("dailyRecommendations.heroTitle", { defaultValue: "Tonight for You" })}
        </Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {recommendation?.name ??
            t("dailyRecommendations.heroSubtitle", {
              defaultValue: "Fresh personalized picks generated daily.",
            })}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: DAILY_PICKS_HERO_HEIGHT,
    borderRadius: radii.card,
    overflow: "hidden",
    marginBottom: 14,
    borderWidth: 1,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: DAILY_PICKS_HERO_HEIGHT * 0.65,
  },
  badge: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#1a1a1a",
    letterSpacing: 0.2,
  },
  content: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#ffffff",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 19,
    color: "rgba(255,255,255,0.9)",
  },
});
