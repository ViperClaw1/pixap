import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View, StyleSheet, useWindowDimensions, InteractionManager, type LayoutChangeEvent } from "react-native";
import { useTranslation } from "react-i18next";
import { SmartImage, preloadSmartImages } from "@/shared/ui/smart-image/SmartImage";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { PLACE_IMAGE_FALLBACK } from "@/shared/assets/placeImageFallback";
import { normalizeBusinessCardImages } from "@/shared/lib/business-card/businessCardImages";
import {
  businessCardDisplayFallback,
  getBusinessCardDisplayUrl,
} from "@/shared/lib/business-card/businessCardDisplayUrl";
import { LiveCrowdCard } from "@/features/live-crowd-meter/ui/LiveCrowdCard";
import type { OnboardingVenue } from "@/entities/user-preferences";

type Props = {
  venue: OnboardingVenue;
};

/** Hero cap so rating controls + body always fit inside the onboarding deck. */
const HERO_HEIGHT_RATIO = 0.44;
const HERO_MAX_WINDOW_RATIO = 0.26;
const HERO_ABSOLUTE_MAX = 210;
const HERO_ABSOLUTE_MIN = 132;

function resolveHeroHeight(cardHeight: number, windowHeight: number): number {
  if (cardHeight <= 0) {
    return Math.round(Math.min(windowHeight * HERO_MAX_WINDOW_RATIO, HERO_ABSOLUTE_MAX));
  }
  const fromCard = Math.round(cardHeight * HERO_HEIGHT_RATIO);
  const fromWindow = Math.round(windowHeight * HERO_MAX_WINDOW_RATIO);
  return Math.max(HERO_ABSOLUTE_MIN, Math.min(fromCard, fromWindow, HERO_ABSOLUTE_MAX));
}

function OnboardingVenueCardInner({ venue }: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { height: windowHeight } = useWindowDimensions();
  const [heroLoading, setHeroLoading] = useState(true);
  const [cardHeight, setCardHeight] = useState(0);

  const heroHeight = useMemo(
    () => resolveHeroHeight(cardHeight, windowHeight),
    [cardHeight, windowHeight],
  );

  const onCardLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.round(event.nativeEvent.layout.height);
    setCardHeight((prev) => (prev === nextHeight ? prev : nextHeight));
  }, []);

  const imageUris = useMemo(() => normalizeBusinessCardImages(venue.images), [venue.images]);
  const heroUri = useMemo(
    () => (imageUris[0] ? getBusinessCardDisplayUrl(imageUris[0], { size: "hero" }) : null),
    [imageUris],
  );
  const heroFallback = businessCardDisplayFallback(heroUri, imageUris[0]);

  useEffect(() => {
    setHeroLoading(true);
  }, [heroUri, venue.venue_id]);

  useEffect(() => {
    if (!heroUri) return;
    let cancelled = false;
    let task: { cancel: () => void } | null = null;
    const timer = setTimeout(() => {
      task = InteractionManager.runAfterInteractions(() => {
        if (!cancelled) void preloadSmartImages([heroUri]);
      });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      task?.cancel();
    };
  }, [heroUri]);

  const displayTags = venue.tags.slice(0, 6);

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]} onLayout={onCardLayout}>
      <View style={[styles.heroWrap, { height: heroHeight }]}>
        <SmartImage
          uri={heroUri}
          fallbackUri={heroFallback}
          bundledFallback={PLACE_IMAGE_FALLBACK}
          recyclingKey={`onboarding-${venue.venue_id}`}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          transition={200}
          showLoadingSpinner
          loadingSpinnerColor={colors.primary}
          onLoadingChange={setHeroLoading}
        />
        {!heroLoading ? <View style={styles.heroOverlay} pointerEvents="none" /> : null}
      </View>
      <View style={styles.bodyHost}>
        <ScrollView
          style={styles.bodyScroll}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
            {venue.name}
          </Text>
          {venue.category_name ? (
            <Text style={[styles.meta, { color: colors.textMuted }]}>{venue.category_name}</Text>
          ) : null}
          {venue.city ? (
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              {t("location", { keyPrefix: "onboarding.venue", city: venue.city })}
            </Text>
          ) : null}
          {displayTags.length > 0 ? (
            <View style={styles.tags}>
              {displayTags.map((tag) => (
                <View key={tag} style={[styles.tag, { borderColor: colors.border }]}>
                  <Text style={[styles.tagText, { color: colors.textMuted }]}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {venue.description ? (
            <Text style={[styles.desc, { color: colors.text }]} numberOfLines={3}>
              {venue.description}
            </Text>
          ) : null}
          <LiveCrowdCard venueId={venue.venue_id} style={styles.crowd} />
        </ScrollView>
      </View>
    </View>
  );
}

export const OnboardingVenueCard = memo(OnboardingVenueCardInner);

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
  },
  heroWrap: {
    width: "100%",
    position: "relative",
    flexShrink: 0,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  bodyHost: {
    flex: 1,
    minHeight: 0,
  },
  bodyScroll: {
    flex: 1,
  },
  body: { padding: 16, gap: 8, paddingBottom: 12 },
  name: { fontSize: 22, fontWeight: "800" },
  meta: { fontSize: 13 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  tagText: { fontSize: 11, fontWeight: "600" },
  desc: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  crowd: { marginTop: 8 },
});
