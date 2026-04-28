import { useMemo, useState } from "react";
import { PixelRatio, View, Text, Pressable, StyleSheet } from "react-native";
import { SmartImage } from "@/components/SmartImage";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, type NavigationProp, type ParamListBase } from "@react-navigation/native";
import type { BusinessCard } from "@/hooks/useBusinessCards";
import { useAuth } from "@/contexts/AuthContext";
import { useIsFavorite, useToggleFavorite } from "@/hooks/useFavorites";
import { getOptimizedImageUrl } from "@/lib/imageUtils";
import { navigateToProfileAuth } from "@/navigation/navigationHelpers";
import type { ThemeColors } from "@/theme/palettes";
import Carousel from "react-native-reanimated-carousel";
import { normalizeBusinessCardImages } from "@/lib/businessCardImages";

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

export default function BusinessPlaceCard({ place, variant, colors, isDark, onOpen }: Props) {
  const navigation = useNavigation();
  const { user } = useAuth();
  const isFavorite = useIsFavorite(place.id);
  const toggleFavorite = useToggleFavorite();
  const [hSlide, setHSlide] = useState(0);
  const [vSlide, setVSlide] = useState(0);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        /** Recommended row — matches web horizontal PlaceCard */
        hRoot: {
          flexDirection: "row",
          gap: 12,
          padding: 12,
          backgroundColor: colors.card,
          borderRadius: 20,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          width: "100%",
        },
        hImageWrap: {
          width: IMAGE_HORIZONTAL,
          height: IMAGE_HORIZONTAL,
          borderRadius: 12,
          overflow: "hidden",
          flexShrink: 0,
        },
        hImage: { width: "100%", height: "100%" },
        hDotsRow: {
          position: "absolute",
          bottom: 6,
          left: 0,
          right: 0,
          flexDirection: "row",
          justifyContent: "center",
          gap: 4,
        },
        hHeartBtn: {
          position: "absolute",
          top: 4,
          right: 4,
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: isDark ? "rgba(26,26,26,0.85)" : "rgba(255,255,255,0.9)",
          alignItems: "center",
          justifyContent: "center",
        },
        hBody: { flex: 1, minWidth: 0, justifyContent: "space-between", paddingVertical: 2 },
        hTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
        hAddress: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
        hTagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
        tagPill: {
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: isDark ? "#0d0d0f" : "#f4f4f5",
          maxWidth: "100%",
        },
        tagText: {
          fontSize: 10,
          fontWeight: "500",
          color: isDark ? "#e8e8ea" : "#27272a",
        },
        /** Featured column — matches web vertical PlaceCard */
        vRoot: { width: IMAGE_VERTICAL_W, flexShrink: 0 },
        vImageBlock: {
          width: IMAGE_VERTICAL_W,
          height: IMAGE_VERTICAL_H,
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: colors.border,
        },
        vImage: { width: "100%", height: "100%" },
        vDotsRow: {
          position: "absolute",
          bottom: 8,
          left: 0,
          right: 0,
          flexDirection: "row",
          justifyContent: "center",
          gap: 4,
        },
        dot: {
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: "rgba(255,255,255,0.45)",
        },
        dotActive: {
          backgroundColor: "rgba(255,255,255,0.92)",
        },
        vHeartBtn: {
          position: "absolute",
          top: 8,
          left: 8,
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: isDark ? "rgba(26,26,26,0.85)" : "rgba(255,255,255,0.9)",
          alignItems: "center",
          justifyContent: "center",
        },
        vRatingPill: {
          position: "absolute",
          top: 8,
          right: 8,
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: isDark ? "rgba(26,26,26,0.9)" : "rgba(255,255,255,0.92)",
        },
        vRatingText: { fontSize: 12, fontWeight: "600", color: colors.text },
        vMeta: { marginTop: 8, paddingHorizontal: 2 },
        vName: { fontSize: 14, fontWeight: "600", color: colors.text },
        vTagsLine: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
        vPrice: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
      }),
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
  const imageUrisRaw = useMemo(() => normalizeBusinessCardImages(place.images), [place.images]);
  const targetDensity = Math.min(2, PixelRatio.get());
  const imageUris = useMemo(
    () =>
      imageUrisRaw.map(
        (url) =>
          getOptimizedImageUrl(
            url,
            Math.round((variant === "horizontal" ? IMAGE_HORIZONTAL : IMAGE_VERTICAL_W) * targetDensity),
            Math.round((variant === "horizontal" ? IMAGE_HORIZONTAL : IMAGE_VERTICAL_H) * targetDensity),
            68,
          ) || url,
      ),
    [imageUrisRaw, targetDensity, variant],
  );

  if (variant === "horizontal") {
    return (
      <Pressable onPress={onOpen} style={styles.hRoot}>
        <View style={styles.hImageWrap}>
          {imageUris.length > 1 ? (
            <>
              <Carousel
                width={IMAGE_HORIZONTAL}
                height={IMAGE_HORIZONTAL}
                data={imageUris}
                loop={false}
                onSnapToItem={setHSlide}
                renderItem={({ item, index }) => (
                  <SmartImage
                    uri={item}
                    fallbackUri={imageUrisRaw[index] ?? null}
                    recyclingKey={`${place.id}-h-${index}`}
                    style={styles.hImage}
                    contentFit="cover"
                    transition={200}
                  />
                )}
              />
              <View style={styles.hDotsRow}>
                {imageUris.map((_, idx) => (
                  <View key={`${place.id}-h-dot-${idx}`} style={[styles.dot, hSlide === idx && styles.dotActive]} />
                ))}
              </View>
            </>
          ) : (
            <SmartImage
              uri={imageUris[0] ?? null}
              fallbackUri={imageUrisRaw[0] ?? null}
              recyclingKey={`${place.id}-h`}
              style={styles.hImage}
              contentFit="cover"
              transition={200}
            />
          )}
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
        {imageUris.length > 1 ? (
          <>
            <Carousel
              width={IMAGE_VERTICAL_W}
              height={IMAGE_VERTICAL_H}
              data={imageUris}
              loop={false}
              onSnapToItem={setVSlide}
              renderItem={({ item, index }) => (
                <SmartImage
                  uri={item}
                  fallbackUri={imageUrisRaw[index] ?? null}
                  recyclingKey={`${place.id}-v-${index}`}
                  style={styles.vImage}
                  contentFit="cover"
                  transition={200}
                />
              )}
            />
            <View style={styles.vDotsRow}>
              {imageUris.map((_, idx) => (
                <View key={`${place.id}-v-dot-${idx}`} style={[styles.dot, vSlide === idx && styles.dotActive]} />
              ))}
            </View>
          </>
        ) : (
          <SmartImage
            uri={imageUris[0] ?? null}
            fallbackUri={imageUrisRaw[0] ?? null}
            recyclingKey={`${place.id}-v`}
            style={styles.vImage}
            contentFit="cover"
            transition={200}
          />
        )}
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
        <Text style={styles.vTagsLine} numberOfLines={1}>
          {displayTags.length > 0 ? displayTags.join(" · ") : " "}
        </Text>
        <Text style={styles.vPrice}>{Number(place.booking_price).toLocaleString()} $</Text>
      </View>
    </Pressable>
  );
}
