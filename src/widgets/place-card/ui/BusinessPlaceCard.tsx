import { memo, useCallback, useMemo } from "react";
import { Dimensions, PixelRatio, View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatedLikeHeart } from "@/shared/ui/animated-like-heart";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { AppPressable } from "@/shared/ui/app-pressable";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, type NavigationProp, type ParamListBase } from "@react-navigation/native";
import type { BusinessCard } from "@/entities/business-card";
import { useAuth } from "@/app/providers/AuthProvider";
import { useIsFavorite, useToggleFavorite } from "@/entities/favorite";
import { getBusinessCardThumbUris } from "@/shared/lib/business-card/businessCardDisplayUrl";
import { getBusinessCardCoverBlurhash } from "@/shared/lib/business-card/businessCardBlurhash";
import { navigateToProfileAuth } from "@/app/navigation/navigationHelpers";
import { useNavigateOnce } from "@/shared/lib/navigation/useNavigateOnce";
import { prefetchBusinessCard } from "@/shared/lib/navigation/prefetchBusinessCard";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";
import { PLACE_IMAGE_FALLBACK } from "@/shared/assets/placeImageFallback";
import { tagTextColorForTint, tintForTagKey } from "@/shared/lib/tagTint";
import { businessPlaceCardStaticStyles, businessPlaceCardThemeStyles } from "./businessPlaceCardStyles";

const PLACE_CARD_IMAGE_TRANSITION_MS = 200;
const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;

type VerticalLayout = "compact" | "fill";

type Props = {
  place: BusinessCard;
  variant: "vertical" | "horizontal";
  /** Vertical card sizing: compact featured tile or fill available parent height. */
  verticalLayout?: VerticalLayout;
  /** Measured content width for `verticalLayout="fill"` (tags + image thumbs). */
  fillWidth?: number;
  /** Measured slide height for `verticalLayout="fill"` image thumb quality. */
  fillHeight?: number;
  /** Show ActivityIndicator instead of bundled placeholder while the hero image loads. */
  showHeroLoadingSpinner?: boolean;
  heroLoadingSpinnerColor?: string;
  /** Defaults to `PlaceDetail` for `place.id` when omitted (stable props for list memo). */
  onOpen?: () => void;
  /** Higher-contrast tag labels; pill background tint is unchanged. */
  enhancedTagContrast?: boolean;
};

const IMAGE_HORIZONTAL = 96;
const IMAGE_VERTICAL_W = 200;
const IMAGE_VERTICAL_H = 140;
/** Home recommended list: content padding + card padding + image + gap. */
const HORIZONTAL_CARD_LAYOUT_CHROME = 14 * 2 + 12 * 2 + IMAGE_HORIZONTAL + 12;
const TAG_HORIZONTAL_PADDING = 16;
const TAG_BORDER_WIDTH = 2;
const TAG_GAP = 6;
const TAG_CHAR_WIDTH_ESTIMATE = 6;

function estimateTagWidth(tag: string): number {
  return tag.trim().length * TAG_CHAR_WIDTH_ESTIMATE + TAG_HORIZONTAL_PADDING + TAG_BORDER_WIDTH;
}

function pickTagsThatFitSingleRow(tags: string[], availableWidth: number): string[] {
  const picked: string[] = [];
  let occupied = 0;
  for (const tag of tags) {
    const width = estimateTagWidth(tag);
    const next = picked.length > 0 ? occupied + TAG_GAP + width : occupied + width;
    if (next > availableWidth) break;
    picked.push(tag);
    occupied = next;
  }
  return picked;
}

function resolvePlaceRating(rating: number | null | undefined): number | null {
  if (rating == null || !Number.isFinite(rating) || rating <= 0) return null;
  return rating;
}

function renderColoredTag(
  tag: string,
  pillStyle: object,
  textStyle: object,
  options?: { enhancedTextContrast?: boolean; isDark?: boolean },
) {
  const tint = tintForTagKey(tag);
  const textColor =
    options?.enhancedTextContrast && options.isDark != null
      ? tagTextColorForTint(tint, options.isDark)
      : tint;
  return (
    <View key={tag} style={[pillStyle, { backgroundColor: `${tint}33` }]}>
      <Text style={[textStyle, { color: textColor }]} numberOfLines={1}>
        {tag}
      </Text>
    </View>
  );
}

type PlaceNameWithRatingProps = {
  name: string;
  rating: number | null;
  nameRowStyle: object;
  nameStyle: object;
  ratingRowStyle: object;
  ratingTextStyle: object;
};

function PlaceNameWithRating({
  name,
  rating,
  nameRowStyle,
  nameStyle,
  ratingRowStyle,
  ratingTextStyle,
}: PlaceNameWithRatingProps) {
  return (
    <View style={nameRowStyle}>
      <Text style={nameStyle} numberOfLines={1}>
        {name}
      </Text>
      {rating != null ? (
        <View style={ratingRowStyle}>
          <Ionicons name="star" size={12} color="#eab308" />
          <Text style={ratingTextStyle}>{rating.toFixed(1)}</Text>
        </View>
      ) : null}
    </View>
  );
}

function PlaceImageRatingBadge({
  rating,
  style,
  textStyle,
}: {
  rating: number;
  style: object;
  textStyle: object;
}) {
  return (
    <View style={style} pointerEvents="none">
      <Ionicons name="star" size={10} color="#eab308" />
      <Text style={textStyle}>{rating.toFixed(1)}</Text>
    </View>
  );
}

function placeCardPropsEqual(prev: Props, next: Props): boolean {
  if (prev.variant !== next.variant || prev.onOpen !== next.onOpen) return false;
  if ((prev.verticalLayout ?? "compact") !== (next.verticalLayout ?? "compact")) return false;
  if (prev.fillWidth !== next.fillWidth) return false;
  if (prev.fillHeight !== next.fillHeight) return false;
  if (prev.showHeroLoadingSpinner !== next.showHeroLoadingSpinner) return false;
  if (prev.heroLoadingSpinnerColor !== next.heroLoadingSpinnerColor) return false;
  if (prev.enhancedTagContrast !== next.enhancedTagContrast) return false;
  if (prev.place.id !== next.place.id) return false;
  const prevThumb = prev.place.images?.[0] ?? prev.place.image ?? "";
  const nextThumb = next.place.images?.[0] ?? next.place.image ?? "";
  const prevBlur = getBusinessCardCoverBlurhash(prev.place.blurhashes) ?? "";
  const nextBlur = getBusinessCardCoverBlurhash(next.place.blurhashes) ?? "";
  return (
    prevThumb === nextThumb &&
    prevBlur === nextBlur &&
    prev.place.name === next.place.name &&
    prev.place.rating === next.place.rating &&
    (prev.place.tags ?? []).join("|") === (next.place.tags ?? []).join("|")
  );
}

type PlaceHeroImageProps = {
  place: BusinessCard;
  variant: "vertical" | "horizontal";
  imageStyle: object;
  layoutWidth?: number;
  layoutHeight?: number;
  showLoadingSpinner?: boolean;
  loadingSpinnerColor?: string;
};

function PlaceHeroImage({
  place,
  variant,
  imageStyle,
  layoutWidth,
  layoutHeight,
  showLoadingSpinner,
  loadingSpinnerColor,
}: PlaceHeroImageProps) {
  const targetDensity = Math.min(2, PixelRatio.get());
  const primaryImageRaw = place.images?.[0] ?? place.image ?? null;
  const thumb = useMemo(() => {
    const layoutW =
      layoutWidth ?? (variant === "horizontal" ? IMAGE_HORIZONTAL : IMAGE_VERTICAL_W);
    const layoutH =
      layoutHeight ?? (variant === "horizontal" ? IMAGE_HORIZONTAL : IMAGE_VERTICAL_H);
    return getBusinessCardThumbUris(place, {
      layoutPx: layoutW * targetDensity,
      layoutPxHeight: layoutH * targetDensity,
    });
  }, [layoutHeight, layoutWidth, place, primaryImageRaw, targetDensity, variant]);

  const coverBlurhash = getBusinessCardCoverBlurhash(place.blurhashes);

  if (!thumb.raw) {
    return (
      <SmartImage
        bundledFallback={PLACE_IMAGE_FALLBACK}
        blurhash={coverBlurhash}
        recyclingKey={`${place.id}-placeholder`}
        style={imageStyle}
        contentFit="cover"
        transition={PLACE_CARD_IMAGE_TRANSITION_MS}
        showLoadingSpinner={showLoadingSpinner}
        loadingSpinnerColor={loadingSpinnerColor}
      />
    );
  }

  return (
    <SmartImage
      key={`${place.id}-${thumb.raw}`}
      uri={thumb.uri}
      fallbackUri={thumb.fallbackUri}
      blurhash={coverBlurhash}
      bundledFallback={PLACE_IMAGE_FALLBACK}
      recyclingKey={thumb.raw}
      style={imageStyle}
      contentFit="cover"
      transition={PLACE_CARD_IMAGE_TRANSITION_MS}
      showLoadingSpinner={showLoadingSpinner}
      loadingSpinnerColor={loadingSpinnerColor}
    />
  );
}

function BusinessPlaceCardInner({
  place,
  variant,
  verticalLayout = "compact",
  fillWidth,
  fillHeight,
  showHeroLoadingSpinner,
  heroLoadingSpinnerColor,
  onOpen,
  enhancedTagContrast = false,
}: Props) {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { i18n } = useTranslation();
  const queryClient = useQueryClient();
  const navigateOnce = useNavigateOnce();
  const isVerticalFill = variant === "vertical" && verticalLayout === "fill";
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();

  const tagRenderOptions = useMemo(
    () => ({ enhancedTextContrast: enhancedTagContrast, isDark }),
    [enhancedTagContrast, isDark],
  );

  const handlePressIn = useCallback(() => {
    void prefetchBusinessCard(queryClient, place.id, i18n.language);
  }, [i18n.language, place.id, queryClient]);

  const handleOpen = useCallback(() => {
    navigateOnce(() => {
      if (onOpen) {
        onOpen();
        return;
      }
      navigation.navigate("PlaceDetail", { id: place.id });
    });
  }, [navigateOnce, navigation, onOpen, place.id]);

  const isFavorite = useIsFavorite(place.id);
  const toggleFavorite = useToggleFavorite();

  const themed = useThemeStyles(({ colors: c }) => businessPlaceCardThemeStyles(c));
  const styles = useMemo(
    () => mergeStaticAndThemed(businessPlaceCardStaticStyles, themed),
    [themed],
  );

  const onFavoritePress = () => {
    if (!user) {
      navigateToProfileAuth(navigation as NavigationProp<ParamListBase>);
      return;
    }
    toggleFavorite.mutate({ businessCardId: place.id, isFavorite });
  };

  const tags = place.tags ?? [];
  const displayTags = tags.length > 0 ? tags : [];
  const rating = resolvePlaceRating(place.rating);
  const verticalCardWidth = isVerticalFill ? (fillWidth ?? SCREEN_WIDTH - 32) : IMAGE_VERTICAL_W;
  const verticalImageThumbHeight = useMemo(() => {
    if (!isVerticalFill) return IMAGE_VERTICAL_H;
    const metaChrome = 52;
    const reasonsChrome = 72;
    const bodyHeight = (fillHeight ?? SCREEN_HEIGHT * 0.55) - reasonsChrome;
    return Math.max(IMAGE_VERTICAL_H, Math.round(bodyHeight - metaChrome));
  }, [fillHeight, isVerticalFill]);
  const featuredVisibleTags = useMemo(
    () => pickTagsThatFitSingleRow(displayTags, verticalCardWidth - 4),
    [displayTags, verticalCardWidth],
  );
  const verticalFillStyles = useMemo(
    () =>
      isVerticalFill
        ? {
            vRoot: { flex: 1, width: "100%", flexShrink: 0 },
            vImageBlock: { flex: 1, width: "100%", minHeight: IMAGE_VERTICAL_H },
          }
        : null,
    [isVerticalFill],
  );
  const horizontalVisibleTags = useMemo(
    () =>
      pickTagsThatFitSingleRow(
        displayTags,
        Math.max(80, SCREEN_WIDTH - HORIZONTAL_CARD_LAYOUT_CHROME),
      ),
    [displayTags],
  );

  if (variant === "horizontal") {
    return (
      <AppPressable onPressIn={handlePressIn} onPress={handleOpen} style={styles.hRoot}>
        <View style={styles.hImageWrap}>
          <PlaceHeroImage
            place={place}
            variant="horizontal"
            imageStyle={styles.hImage}
            showLoadingSpinner={showHeroLoadingSpinner}
            loadingSpinnerColor={heroLoadingSpinnerColor}
          />
          <AppPressable style={styles.hHeartBtn} onPress={onFavoritePress} hitSlop={8}>
            <AnimatedLikeHeart
              liked={isFavorite}
              size={15}
              color={colors.text}
              likedColor={colors.danger}
            />
          </AppPressable>
        </View>
        <View style={styles.hBody}>
          <View>
            <PlaceNameWithRating
              name={place.name}
              rating={rating}
              nameRowStyle={styles.nameRow}
              nameStyle={styles.hTitle}
              ratingRowStyle={styles.ratingRow}
              ratingTextStyle={styles.ratingText}
            />
            {place.address?.trim() ? (
              <Text style={styles.hAddress} numberOfLines={2}>
                {place.address.trim()}
              </Text>
            ) : null}
          </View>
          <View style={styles.hTagsRow}>
            {horizontalVisibleTags.map((tag) =>
              renderColoredTag(tag, styles.tagPill, styles.tagText, tagRenderOptions),
            )}
          </View>
        </View>
      </AppPressable>
    );
  }

  return (
    <AppPressable
      onPressIn={handlePressIn}
      onPress={handleOpen}
      style={[styles.vRoot, verticalFillStyles?.vRoot]}
    >
      <View style={[styles.vImageBlock, verticalFillStyles?.vImageBlock]}>
        <PlaceHeroImage
          place={place}
          variant="vertical"
          imageStyle={styles.vImage}
          layoutWidth={isVerticalFill ? verticalCardWidth : undefined}
          layoutHeight={isVerticalFill ? verticalImageThumbHeight : undefined}
          showLoadingSpinner={showHeroLoadingSpinner}
          loadingSpinnerColor={heroLoadingSpinnerColor}
        />
        <AppPressable style={styles.vHeartBtn} onPress={onFavoritePress} hitSlop={8}>
          <AnimatedLikeHeart
            liked={isFavorite}
            size={16}
            color={colors.text}
            likedColor={colors.danger}
          />
        </AppPressable>
        {rating != null ? (
          <PlaceImageRatingBadge
            rating={rating}
            style={styles.vRatingBadge}
            textStyle={styles.vRatingBadgeText}
          />
        ) : null}
      </View>
      <View style={styles.vMeta}>
        <Text style={styles.vName} numberOfLines={1}>
          {place.name}
        </Text>
        {featuredVisibleTags.length > 0 ? (
          <View style={styles.vTagsRow}>
            {featuredVisibleTags.map((tag) =>
              renderColoredTag(tag, styles.vTagPill, styles.vTagText, tagRenderOptions),
            )}
          </View>
        ) : null}
      </View>
    </AppPressable>
  );
}

const BusinessPlaceCard = memo(BusinessPlaceCardInner, placeCardPropsEqual);
export default BusinessPlaceCard;
