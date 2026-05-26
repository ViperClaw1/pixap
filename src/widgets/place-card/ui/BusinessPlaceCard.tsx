import { memo, useCallback, useMemo } from "react";
import { PixelRatio, View, Text, Pressable, useWindowDimensions } from "react-native";
import { AnimatedLikeHeart } from "@/shared/ui/animated-like-heart";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, type NavigationProp, type ParamListBase } from "@react-navigation/native";
import type { BusinessCard } from "@/entities/business-card";
import { useAuth } from "@/app/providers/AuthProvider";
import { useIsFavorite, useToggleFavorite } from "@/entities/favorite";
import { getBusinessCardThumbUris } from "@/shared/lib/business-card/businessCardDisplayUrl";
import { navigateToProfileAuth } from "@/app/navigation/navigationHelpers";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";
import { PLACE_IMAGE_FALLBACK } from "@/shared/assets/placeImageFallback";
import { businessPlaceCardStaticStyles, businessPlaceCardThemeStyles } from "./businessPlaceCardStyles";

const PLACE_CARD_IMAGE_TRANSITION_MS = 200;

type Props = {
  place: BusinessCard;
  variant: "vertical" | "horizontal";
  /** Defaults to `PlaceDetail` for `place.id` when omitted (stable props for list memo). */
  onOpen?: () => void;
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

function placeCardPropsEqual(prev: Props, next: Props): boolean {
  if (prev.variant !== next.variant || prev.onOpen !== next.onOpen) return false;
  if (prev.place.id !== next.place.id) return false;
  const prevThumb = prev.place.images?.[0] ?? prev.place.image ?? "";
  const nextThumb = next.place.images?.[0] ?? next.place.image ?? "";
  return prevThumb === nextThumb && prev.place.name === next.place.name;
}

type PlaceHeroImageProps = {
  place: BusinessCard;
  variant: "vertical" | "horizontal";
  imageStyle: object;
};

function PlaceHeroImage({ place, variant, imageStyle }: PlaceHeroImageProps) {
  const targetDensity = Math.min(2, PixelRatio.get());
  const primaryImageRaw = place.images?.[0] ?? place.image ?? null;
  const thumb = useMemo(() => {
    const layoutW = variant === "horizontal" ? IMAGE_HORIZONTAL : IMAGE_VERTICAL_W;
    const layoutH = variant === "horizontal" ? IMAGE_HORIZONTAL : IMAGE_VERTICAL_H;
    return getBusinessCardThumbUris(place, {
      layoutPx: layoutW * targetDensity,
      layoutPxHeight: layoutH * targetDensity,
    });
  }, [place, primaryImageRaw, targetDensity, variant]);

  const coverBlurhash =
    typeof place.blurhashes?.[0] === "string" && place.blurhashes[0].trim().length > 0
      ? place.blurhashes[0]
      : undefined;

  if (!thumb.raw) {
    return (
      <SmartImage
        bundledFallback={PLACE_IMAGE_FALLBACK}
        recyclingKey={`${place.id}-placeholder`}
        style={imageStyle}
        contentFit="cover"
        transition={PLACE_CARD_IMAGE_TRANSITION_MS}
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
    />
  );
}

function BusinessPlaceCardInner({ place, variant, onOpen }: Props) {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { width: windowWidth } = useWindowDimensions();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const handleOpen = useCallback(() => {
    if (onOpen) {
      onOpen();
      return;
    }
    navigation.navigate("PlaceDetail", { id: place.id });
  }, [navigation, onOpen, place.id]);
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
  const featuredVisibleTags = useMemo(
    () => pickTagsThatFitSingleRow(displayTags, IMAGE_VERTICAL_W - 4),
    [displayTags],
  );
  const horizontalVisibleTags = useMemo(
    () =>
      pickTagsThatFitSingleRow(
        displayTags,
        Math.max(80, windowWidth - HORIZONTAL_CARD_LAYOUT_CHROME),
      ),
    [displayTags, windowWidth],
  );

  if (variant === "horizontal") {
    return (
      <Pressable onPress={handleOpen} style={styles.hRoot}>
        <View style={styles.hImageWrap}>
          <PlaceHeroImage place={place} variant="horizontal" imageStyle={styles.hImage} />
          <Pressable style={styles.hHeartBtn} onPress={onFavoritePress} hitSlop={8}>
            <AnimatedLikeHeart
              liked={isFavorite}
              size={15}
              color={colors.text}
              likedColor={colors.danger}
            />
          </Pressable>
        </View>
        <View style={styles.hBody}>
          <View>
            <Text style={styles.hTitle} numberOfLines={1}>
              {place.name}
            </Text>
            {place.address?.trim() ? (
              <Text style={styles.hAddress} numberOfLines={2}>
                {place.address.trim()}
              </Text>
            ) : null}
          </View>
          <View style={styles.hTagsRow}>
            {horizontalVisibleTags.map((tag) => (
              <View key={tag} style={styles.tagPill}>
                <Text style={styles.tagText} numberOfLines={1}>
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={handleOpen} style={styles.vRoot}>
      <View style={styles.vImageBlock}>
        <PlaceHeroImage place={place} variant="vertical" imageStyle={styles.vImage} />
        <Pressable style={styles.vHeartBtn} onPress={onFavoritePress} hitSlop={8}>
          <AnimatedLikeHeart
            liked={isFavorite}
            size={16}
            color={colors.text}
            likedColor={colors.danger}
          />
        </Pressable>
        <View style={styles.vRatingPill}>
          <Ionicons name="star" size={12} color="#eab308" />
          <Text style={styles.vRatingText}>{Number(place.rating).toFixed(1)}</Text>
        </View>
      </View>
      <View style={styles.vMeta}>
        <Text style={styles.vName} numberOfLines={1}>
          {place.name}
        </Text>
        {featuredVisibleTags.length > 0 ? (
          <View style={styles.vTagsRow}>
            {featuredVisibleTags.map((tag) => (
              <View key={`${place.id}-v-tag-${tag}`} style={styles.vTagPill}>
                <Text style={styles.vTagText} numberOfLines={1}>
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const BusinessPlaceCard = memo(BusinessPlaceCardInner, placeCardPropsEqual);
export default BusinessPlaceCard;
