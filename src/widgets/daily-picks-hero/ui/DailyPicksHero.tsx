import { useCallback, useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { PLACE_IMAGE_FALLBACK } from "@/shared/assets/placeImageFallback";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { getPrimaryBusinessCardImage } from "@/shared/lib/business-card/businessCardImages";
import {
  businessCardDisplayFallback,
  getBusinessCardDisplayUrl,
} from "@/shared/lib/business-card/businessCardDisplayUrl";
import { ctaGradientColors, HERO_OVERLAY_GRADIENT } from "@/shared/theme/gradients";
import { radii } from "@/shared/theme/radii";
import type { DailyPicksHeroDisplay } from "../lib/resolveDailyPicksHeroDisplay";

export const DAILY_PICKS_HERO_HEIGHT = 220;

const HERO_SHELL_FADE_MS = 280;
const HERO_IMAGE_FADE_MS = 320;

type Props = {
  display: DailyPicksHeroDisplay;
  onOpen: () => void;
};

export function DailyPicksHero({ display, onOpen }: Props) {
  const { t } = useTranslation();
  const { colors, isDark } = useAppTheme();
  const { recommendation, source } = display;
  const shellOpacity = useSharedValue(0);
  const imageOpacity = useSharedValue(0);

  const heroRaw = recommendation ? getPrimaryBusinessCardImage(recommendation.images) : null;
  const heroUri = heroRaw
    ? getBusinessCardDisplayUrl(heroRaw, { size: "hero" })
    : null;
  const showPlaceholder = source === "placeholder";
  const showHeroImage = !showPlaceholder && Boolean(heroUri);

  useEffect(() => {
    shellOpacity.value = withTiming(1, { duration: HERO_SHELL_FADE_MS });
  }, [shellOpacity]);

  useEffect(() => {
    if (!showHeroImage) {
      imageOpacity.value = 1;
      return;
    }
    imageOpacity.value = 0;
  }, [heroUri, imageOpacity, showHeroImage]);

  const handleImageLoadingChange = useCallback(
    (loading: boolean) => {
      if (!loading) {
        imageOpacity.value = withTiming(1, { duration: HERO_IMAGE_FADE_MS });
      }
    },
    [imageOpacity],
  );

  const shellStyle = useAnimatedStyle(() => ({
    opacity: shellOpacity.value,
  }));
  const imageLayerStyle = useAnimatedStyle(() => ({
    opacity: imageOpacity.value,
  }));

  const badgeLabel =
    source === "recent"
      ? t("dailyRecommendations.heroNewSpot", { defaultValue: "New spot" })
      : source === "placeholder"
        ? t("dailyRecommendations.heroExplore", { defaultValue: "Explore" })
        : t("dailyRecommendations.todaysPick");

  const subtitle =
    source === "recommendation" || source === "recent"
      ? (recommendation?.name ??
        t("dailyRecommendations.heroSubtitle", {
          defaultValue: "Fresh personalized picks generated daily.",
        }))
      : t("dailyRecommendations.heroPlaceholderSubtitle", {
          defaultValue: "Discover restaurants, bars, salons and events near you.",
        });

  const accessibilityLabel =
    source === "recommendation"
      ? t("dailyRecommendations.openHero", { defaultValue: "Open daily recommendations" })
      : source === "recent"
        ? t("dailyRecommendations.openRecentHero", {
            defaultValue: "Open recently added venue",
            name: recommendation?.name ?? "",
          })
        : t("dailyRecommendations.openExploreHero", { defaultValue: "Explore venues" });

  return (
    <Animated.View style={shellStyle}>
      <Pressable
        style={[styles.wrap, { borderColor: colors.border }]}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {showPlaceholder ? (
          <LinearGradient
            colors={[...ctaGradientColors(isDark)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.image}
          >
            <View style={styles.placeholderIconWrap} pointerEvents="none">
              <Ionicons name="sparkles" size={40} color="rgba(255,255,255,0.55)" />
            </View>
          </LinearGradient>
        ) : showHeroImage ? (
          <View style={styles.imageStage}>
            <LinearGradient
              colors={[...ctaGradientColors(isDark)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Animated.View style={[StyleSheet.absoluteFill, imageLayerStyle]}>
              <SmartImage
                uri={heroUri}
                fallbackUri={businessCardDisplayFallback(heroUri, heroRaw)}
                bundledFallback={PLACE_IMAGE_FALLBACK}
                recyclingKey={recommendation?.venue_id ?? "daily-picks-hero"}
                style={styles.fullImage}
                contentFit="cover"
                showShimmerWhileLoading
                transition={HERO_IMAGE_FADE_MS}
                onLoadingChange={handleImageLoadingChange}
              />
            </Animated.View>
          </View>
        ) : (
          <LinearGradient
            colors={[...ctaGradientColors(isDark)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.image}
          />
        )}

        <LinearGradient colors={[...HERO_OVERLAY_GRADIENT]} style={styles.gradient} pointerEvents="none" />

        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeLabel}</Text>
        </View>

        <View style={styles.content} pointerEvents="none">
          <Text style={styles.title}>
            {t("dailyRecommendations.heroTitle", { defaultValue: "Tonight for You" })}
          </Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
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
  imageStage: {
    ...StyleSheet.absoluteFillObject,
  },
  fullImage: {
    width: "100%",
    height: DAILY_PICKS_HERO_HEIGHT,
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
  placeholderIconWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
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
