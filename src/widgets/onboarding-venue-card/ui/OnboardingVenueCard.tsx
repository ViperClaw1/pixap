import { memo, useEffect, useMemo } from "react";
import { Text, View, StyleSheet, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { SmartImage, preloadSmartImages } from "@/shared/ui/smart-image/SmartImage";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { PLACE_IMAGE_FALLBACK } from "@/shared/assets/placeImageFallback";
import { getFeedPostCarouselImageUrl } from "@/shared/lib/feedMediaUrls";
import { normalizeBusinessCardImages } from "@/shared/lib/business-card/businessCardImages";
import { LiveCrowdCard } from "@/features/live-crowd-meter/ui/LiveCrowdCard";
import type { OnboardingVenue } from "@/entities/user-preferences";

type Props = {
  venue: OnboardingVenue;
};

function OnboardingVenueCardInner({ venue }: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { height: windowHeight } = useWindowDimensions();
  const heroHeight = Math.round(windowHeight * 0.48);

  const imageUris = useMemo(() => normalizeBusinessCardImages(venue.images), [venue.images]);
  const heroUri = useMemo(
    () => (imageUris[0] ? getFeedPostCarouselImageUrl(imageUris[0]) || imageUris[0] : null),
    [imageUris],
  );

  useEffect(() => {
    if (heroUri) void preloadSmartImages([heroUri]);
  }, [heroUri]);

  const displayTags = venue.tags.slice(0, 6);

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={[styles.heroWrap, { height: heroHeight }]}>
        <SmartImage
          uri={heroUri}
          fallbackUri={imageUris[0] ?? null}
          bundledFallback={PLACE_IMAGE_FALLBACK}
          recyclingKey={`onboarding-${venue.venue_id}`}
          style={styles.hero}
          contentFit="cover"
          transition={200}
        />
        <View style={styles.heroOverlay} />
      </View>
      <View style={styles.body}>
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
  heroWrap: { width: "100%", position: "relative" },
  hero: { width: "100%", height: "100%" },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  body: { padding: 16, gap: 8, flex: 1 },
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
