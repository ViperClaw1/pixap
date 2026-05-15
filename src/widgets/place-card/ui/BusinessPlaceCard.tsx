import { useMemo } from "react";
import { PixelRatio, View, Text, Pressable } from "react-native";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, type NavigationProp, type ParamListBase } from "@react-navigation/native";
import type { BusinessCard } from "@/entities/business-card";
import { useAuth } from "@/app/providers/AuthProvider";
import { useIsFavorite, useToggleFavorite } from "@/entities/favorite";
import { getOptimizedImageUrl } from "@/shared/lib/imageUtils";
import { navigateToProfileAuth } from "@/app/navigation/navigationHelpers";
import type { ThemeColors } from "@/shared/theme/palettes";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { businessPlaceCardStaticStyles, businessPlaceCardThemeStyles } from "./businessPlaceCardStyles";
import { normalizeBusinessCardImages } from "@/shared/lib/business-card/businessCardImages";

type Props = {
  place: BusinessCard;
  variant: "vertical" | "horizontal";
  colors: ThemeColors;
  isDark: boolean;
  onOpen: () => void;
};

const IMAGE_HORIZONTAL = 96;
const IMAGE_VERTICAL_W = 200;
const IMAGE_VERTICAL_H = 140;
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

export default function BusinessPlaceCard({ place, variant, colors, isDark, onOpen }: Props) {
  const navigation = useNavigation();
  const { user } = useAuth();
  const isFavorite = useIsFavorite(place.id);
  const toggleFavorite = useToggleFavorite();

  const styles = useMemo(
    () => mergeStaticAndThemed(businessPlaceCardStaticStyles, businessPlaceCardThemeStyles(colors, isDark)),
    [colors, isDark],
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
  const imageUrisRaw = useMemo(() => normalizeBusinessCardImages(place.images), [place.images]);
  const targetDensity = Math.min(2, PixelRatio.get());
  const lastImageRaw = imageUrisRaw.length > 0 ? imageUrisRaw[imageUrisRaw.length - 1] : null;
  const lastImageOptimized = useMemo(
    () =>
      lastImageRaw
        ? getOptimizedImageUrl(
            lastImageRaw,
            Math.round((variant === "horizontal" ? IMAGE_HORIZONTAL : IMAGE_VERTICAL_W) * targetDensity),
            Math.round((variant === "horizontal" ? IMAGE_HORIZONTAL : IMAGE_VERTICAL_H) * targetDensity),
            68,
          ) || lastImageRaw
        : null,
    [lastImageRaw, targetDensity, variant],
  );

  if (variant === "horizontal") {
    return (
      <Pressable onPress={onOpen} style={styles.hRoot}>
        <View style={styles.hImageWrap}>
          <SmartImage
            uri={lastImageOptimized}
            fallbackUri={lastImageRaw}
            recyclingKey={`${place.id}-h`}
            style={styles.hImage}
            contentFit="cover"
            transition={200}
          />
          <Pressable style={styles.hHeartBtn} onPress={onFavoritePress} hitSlop={8}>
            <Ionicons
              name={isFavorite ? "heart" : "heart-outline"}
              size={15}
              color={isFavorite ? colors.danger : colors.text}
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
            {displayTags.map((tag) => (
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
    <Pressable onPress={onOpen} style={styles.vRoot}>
      <View style={styles.vImageBlock}>
        <SmartImage
          uri={lastImageOptimized}
          fallbackUri={lastImageRaw}
          recyclingKey={`${place.id}-v`}
          style={styles.vImage}
          contentFit="cover"
          transition={200}
        />
        <Pressable style={styles.vHeartBtn} onPress={onFavoritePress} hitSlop={8}>
          <Ionicons
            name={isFavorite ? "heart" : "heart-outline"}
            size={16}
            color={isFavorite ? colors.danger : colors.text}
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
