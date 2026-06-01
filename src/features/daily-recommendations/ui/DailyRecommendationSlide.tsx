import { memo, useMemo } from "react";
import { PixelRatio, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { DailyRecommendation } from "@/entities/daily-recommendation";
import { PLACE_IMAGE_FALLBACK } from "@/shared/assets/placeImageFallback";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { getPrimaryBusinessCardImage } from "@/shared/lib/business-card/businessCardImages";
import {
  businessCardDisplayFallback,
  getBusinessCardDisplayUrl,
} from "@/shared/lib/business-card/businessCardDisplayUrl";
import { DAILY_RECOMMENDATION_SLIDE_EDGE_INSET } from "../lib/dailyRecommendationsLayout";
import {
  formatRecommendationReasonLabel,
  getRecommendationReasonIcon,
} from "../lib/recommendationReasonMeta";

const REASON_CARD_COUNT = 4;
const IMAGE_META_MIN_HEIGHT = 108;

type Props = {
  item: DailyRecommendation;
  slideWidth: number;
  slideHeight: number;
  slideIndex: number;
  slideTotal: number;
  addressLine: string | null;
  accentColor: string;
  textMutedColor: string;
  reasonCardIconColor: string;
  reasonCardBackground: string;
  reasonCardBorder: string;
  heroLoadingSpinnerColor: string;
};

function formatLocationLine(address: string | null, city: string | null): string | null {
  const addr = address?.trim();
  const c = city?.trim();
  if (addr && c && !addr.toLowerCase().includes(c.toLowerCase())) return `${addr}, ${c}`;
  return addr || c || null;
}

function DailyRecommendationSlideInner({
  item,
  slideWidth,
  slideHeight,
  slideIndex,
  slideTotal,
  addressLine,
  accentColor,
  textMutedColor,
  reasonCardIconColor,
  reasonCardBackground,
  reasonCardBorder,
  heroLoadingSpinnerColor,
}: Props) {
  const { t } = useTranslation();

  const reasons = (item.recommendation_reasons ?? []).slice(0, REASON_CARD_COUNT);
  const primaryReason = reasons[0] ?? null;
  const locationLine = addressLine ?? formatLocationLine(null, item.city);
  const ratingLabel = item.rating > 0 ? item.rating.toFixed(1) : null;

  const heroUris = useMemo(() => {
    const raw = getPrimaryBusinessCardImage(item.images);
    if (!raw) return { uri: null as string | null, fallbackUri: null as string | null };
    const edge = Math.round(slideWidth * Math.min(2, PixelRatio.get()));
    const imageHeight = Math.max(200, slideHeight - 100);
    const uri = getBusinessCardDisplayUrl(raw, { layoutPx: edge, layoutPxHeight: Math.round(imageHeight * 2) });
    return { uri, fallbackUri: businessCardDisplayFallback(uri, raw) ?? null };
  }, [item.images, slideHeight, slideWidth]);

  const visibleTags = item.tags ?? [];

  return (
    <View
      style={[
        styles.slide,
        {
          width: slideWidth,
          height: slideHeight,
          paddingHorizontal: DAILY_RECOMMENDATION_SLIDE_EDGE_INSET,
        },
      ]}
    >
      <View style={styles.slideBody}>
      <View style={styles.heroBlock}>
        <SmartImage
          uri={heroUris.uri}
          fallbackUri={heroUris.fallbackUri}
          bundledFallback={PLACE_IMAGE_FALLBACK}
          recyclingKey={`${item.venue_id}-daily-hero`}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          showLoadingSpinner
          loadingSpinnerColor={heroLoadingSpinnerColor}
        />

        {ratingLabel ? (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={12} color="#eab308" />
            <Text style={styles.ratingBadgeText}>{ratingLabel}</Text>
          </View>
        ) : null}

        {primaryReason ? (
          <View style={[styles.reasonHeroBadge, { backgroundColor: accentColor }]}>
            <Ionicons name={getRecommendationReasonIcon(primaryReason)} size={12} color="#ffffff" />
            <Text style={styles.reasonHeroBadgeText} numberOfLines={1}>
              {formatRecommendationReasonLabel(primaryReason, t)}
            </Text>
          </View>
        ) : null}

        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.88)", "#000000"]}
          locations={[0.35, 0.62, 0.82, 1]}
          style={styles.heroGradient}
          pointerEvents="none"
        />

        <View style={styles.heroMeta}>
          <View style={styles.heroMetaTop}>
            <Text style={styles.venueName} numberOfLines={2}>
              {item.name}
            </Text>
            <View style={styles.slideCounter}>
              <Text style={styles.slideCounterText}>
                {slideIndex + 1} / {slideTotal}
              </Text>
            </View>
          </View>

          {locationLine ? (
            <View style={styles.addressRow}>
              <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.85)" />
              <Text style={styles.addressText} numberOfLines={2}>
                {locationLine}
              </Text>
            </View>
          ) : null}

          {visibleTags.length > 0 ? (
            <View style={styles.tagsRow}>
              {visibleTags.map((tag) => (
                <View key={`${item.venue_id}-${tag}`} style={styles.tagPill}>
                  <Text style={styles.tagText} numberOfLines={1}>
                    {tag}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      {reasons.length > 0 ? (
        <View style={styles.reasonCardsRow}>
          {reasons.map((reason) => (
            <View
              key={`${item.venue_id}-${reason}`}
              style={[
                styles.reasonCard,
                { backgroundColor: reasonCardBackground, borderColor: reasonCardBorder },
              ]}
            >
              <Ionicons name={getRecommendationReasonIcon(reason)} size={18} color={reasonCardIconColor} />
              <Text style={[styles.reasonCardText, { color: textMutedColor }]} numberOfLines={3}>
                {formatRecommendationReasonLabel(reason, t)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      </View>
    </View>
  );
}

export const DailyRecommendationSlide = memo(DailyRecommendationSlideInner);

const styles = StyleSheet.create({
  slide: {
    flex: 1,
  },
  slideBody: {
    flex: 1,
    minHeight: 0,
  },
  heroBlock: {
    flex: 1,
    minHeight: 0,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#111",
  },
  ratingBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    zIndex: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  ratingBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  reasonHeroBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: "52%",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  reasonHeroBadgeText: {
    flexShrink: 1,
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  heroGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "58%",
    zIndex: 1,
  },
  heroMeta: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 8,
    minHeight: IMAGE_META_MIN_HEIGHT,
    justifyContent: "flex-end",
    gap: 6,
  },
  heroMetaTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  venueName: {
    flex: 1,
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 24,
    color: "#ffffff",
  },
  slideCounter: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  slideCounterText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
  },
  addressText: {
    flex: 1,
    color: "rgba(255,255,255,0.88)",
    fontSize: 12,
    lineHeight: 16,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    maxWidth: "100%",
  },
  tagText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "600",
  },
  reasonCardsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    flexShrink: 0,
  },
  reasonCard: {
    flex: 1,
    minHeight: 76,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  reasonCardText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "600",
    textAlign: "center",
  },
});
