import { AppPressable } from "@/shared/ui/app-pressable";
import { memo, useMemo } from "react";
import { ActivityIndicator, PixelRatio, Text, useWindowDimensions, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { useNavigation } from "@react-navigation/native";
import type { PixAIPlace } from "@/entities/pixai";
import { PLACE_IMAGE_FALLBACK } from "@/shared/assets/placeImageFallback";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { getPrimaryBusinessCardImage } from "@/shared/lib/business-card/businessCardImages";
import {
  businessCardDisplayFallback,
  getBusinessCardDisplayUrl,
} from "@/shared/lib/business-card/businessCardDisplayUrl";
import { getBusinessCardCoverBlurhash } from "@/shared/lib/business-card/businessCardBlurhash";
import { useIsFavorite, useToggleFavorite } from "@/entities/favorite";
import { useAuth } from "@/app/providers/AuthProvider";
import { navigateToProfileAuth } from "@/app/navigation/navigationHelpers";
import { AnimatedLikeHeart } from "@/shared/ui/animated-like-heart";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { tintForTagKey } from "@/shared/lib/tagTint";
import type { AIBookingStyles } from "./aiBookingStyles";

const THUMB_SIZE_DEFAULT = 112;
const THUMB_SIZE_COMPACT = 88;
const COMPACT_CARD_WIDTH = 360;
const MAX_TAGS = 3;
const BOOK_GRADIENT_LIGHT = ["#9333ea", "#db2777", "#f97316"] as const;
const BOOK_GRADIENT_DARK = ["#6d28d9", "#be185d", "#ea580c"] as const;

function placeThumbUris(
  images: unknown,
  thumbSize: number,
): { uri: string | null; fallbackUri: string | null } {
  const raw = getPrimaryBusinessCardImage(images);
  if (!raw) return { uri: null, fallbackUri: null };
  const edge = Math.round(thumbSize * Math.min(2, PixelRatio.get()));
  const uri = getBusinessCardDisplayUrl(raw, { layoutPx: edge, layoutPxHeight: edge });
  return { uri, fallbackUri: businessCardDisplayFallback(uri, raw) ?? null };
}

type TagItem = { key: string; label: string; tint: string };

function buildVisibleTags(placeTags: string[] | undefined): TagItem[] {
  const items: TagItem[] = [];
  for (const tag of placeTags ?? []) {
    const label = tag.trim();
    if (!label) continue;
    if (items.some((item) => item.label.toLowerCase() === label.toLowerCase())) continue;
    items.push({
      key: `tag-${label}`,
      label,
      tint: tintForTagKey(label),
    });
    if (items.length >= MAX_TAGS) break;
  }
  return items;
}

function visibleTagLabelsEqual(prevTags: string[] | undefined, nextTags: string[] | undefined): boolean {
  const prev = buildVisibleTags(prevTags);
  const next = buildVisibleTags(nextTags);
  if (prev.length !== next.length) return false;
  return prev.every((tag, index) => tag.label === next[index]?.label);
}

function placesEqualByCardData(prev: PixAIPlace, next: PixAIPlace): boolean {
  return (
    prev.id === next.id &&
    prev.name === next.name &&
    prev.address === next.address &&
    prev.city === next.city &&
    prev.rating === next.rating &&
    prev.booking_price === next.booking_price &&
    getPrimaryBusinessCardImage(prev.images) === getPrimaryBusinessCardImage(next.images) &&
    getBusinessCardCoverBlurhash(prev.blurhashes) === getBusinessCardCoverBlurhash(next.blurhashes) &&
    visibleTagLabelsEqual(prev.tags, next.tags)
  );
}

type Props = {
  styles: AIBookingStyles;
  place: PixAIPlace;
  selected: boolean;
  personsLabel: string;
  bookingTimeLabel?: string | null;
  bookingLoading?: boolean;
  bookingDisabled?: boolean;
  onBook: (place: PixAIPlace) => void;
};

function AIBookingSuggestedPlaceCardInner({
  styles: s,
  place,
  selected,
  personsLabel,
  bookingTimeLabel,
  bookingLoading = false,
  bookingDisabled = false,
  onBook,
}: Props) {
  const { t } = useTranslation();
  const { colors, isDark } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { user } = useAuth();
  const thumbSize = windowWidth <= COMPACT_CARD_WIDTH ? THUMB_SIZE_COMPACT : THUMB_SIZE_DEFAULT;
  const { uri, fallbackUri } = placeThumbUris(place.images, thumbSize);
  const coverBlurhash = getBusinessCardCoverBlurhash(place.blurhashes);
  const isFavorite = useIsFavorite(place.id);
  const toggleFavorite = useToggleFavorite();

  const visibleTags = useMemo(() => buildVisibleTags(place.tags), [place.tags]);
  const addressLine = place.address?.trim() ?? "";

  const onFavoritePress = () => {
    if (!user) {
      navigateToProfileAuth(navigation);
      return;
    }
    toggleFavorite.mutate({ businessCardId: place.id, isFavorite });
  };

  return (
    <View style={[s.placeCard, selected && s.placeCardSelected]}>
      <View style={s.placeRow}>
        <SmartImage
          uri={uri}
          fallbackUri={fallbackUri}
          bundledFallback={PLACE_IMAGE_FALLBACK}
          blurhash={coverBlurhash}
          skipBundledPlaceholder={Boolean(coverBlurhash)}
          style={[s.placeThumb, { width: thumbSize, height: thumbSize }]}
          contentFit="cover"
          transition={0}
        />
        <View style={s.placeTextCol}>
          <View>
            <View style={s.placeNameRow}>
              <Text style={s.placeName} numberOfLines={2}>
                {place.name}
              </Text>
              <AppPressable style={s.placeHeartBtn} onPress={onFavoritePress} hitSlop={8}>
                <AnimatedLikeHeart
                  liked={isFavorite}
                  size={18}
                  color={colors.textMuted}
                  likedColor={colors.danger}
                />
              </AppPressable>
            </View>
            {addressLine ? (
              <View style={s.placeAddressRow}>
                <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                <Text style={s.placeAddressText} numberOfLines={2}>
                  {addressLine}
                </Text>
              </View>
            ) : null}
            {visibleTags.length > 0 ? (
              <View style={s.placeTagsRow}>
                {visibleTags.map((tag) => (
                  <View
                    key={tag.key}
                    style={[s.placeTagPill, { backgroundColor: `${tag.tint}33` }]}
                  >
                    <Text style={[s.placeTagText, { color: tag.tint }]} numberOfLines={1}>
                      {tag.label}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
          <View style={s.placeFooterRow}>
            <View style={s.placeMetaCol}>
              <View style={s.placeRatingRow}>
                <Ionicons name="star" size={14} color="#eab308" />
                <Text style={s.placeRatingText}>{Number(place.rating).toFixed(1)}</Text>
              </View>
              {bookingTimeLabel ? (
                <Text style={s.placeBookingMeta} numberOfLines={1}>
                  {bookingTimeLabel} • {personsLabel}
                </Text>
              ) : (
                <Text style={s.placeBookingMeta} numberOfLines={1}>
                  {personsLabel}
                </Text>
              )}
            </View>
            <AppPressable
              style={[s.placeBookBtnPressable, bookingDisabled && !bookingLoading && { opacity: 0.55 }]}
              onPress={() => onBook(place)}
              disabled={bookingDisabled}
              accessibilityState={{ disabled: bookingDisabled, busy: bookingLoading }}
            >
              <LinearGradient
                colors={isDark ? [...BOOK_GRADIENT_DARK] : [...BOOK_GRADIENT_LIGHT]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[s.placeBookBtnGradient, bookingLoading && { opacity: 0.9 }]}
              >
                <View
                  style={[s.placeBookBtnContent, bookingLoading && s.placeBookBtnContentHidden]}
                  pointerEvents="none"
                  importantForAccessibility="no-hide-descendants"
                  accessibilityElementsHidden={bookingLoading}
                >
                  <Ionicons name="calendar-outline" size={14} color="#ffffff" />
                  <Text style={s.placeBookBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                    {t("aiBooking.bookPlace")}
                  </Text>
                </View>
                {bookingLoading ? (
                  <View style={s.placeBookBtnSpinnerOverlay} pointerEvents="none">
                    <ActivityIndicator size="small" color="#ffffff" />
                  </View>
                ) : null}
              </LinearGradient>
            </AppPressable>
          </View>
        </View>
      </View>
    </View>
  );
}

export const AIBookingSuggestedPlaceCard = memo(
  AIBookingSuggestedPlaceCardInner,
  (prev, next) =>
    placesEqualByCardData(prev.place, next.place) &&
    prev.selected === next.selected &&
    prev.personsLabel === next.personsLabel &&
    prev.bookingTimeLabel === next.bookingTimeLabel &&
    prev.bookingLoading === next.bookingLoading &&
    prev.bookingDisabled === next.bookingDisabled &&
    prev.onBook === next.onBook,
);
