import { useMemo, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Carousel from "react-native-reanimated-carousel";
import { SmartImage } from "@/components/SmartImage";
import type { ThemeColors } from "@/theme/palettes";
import { getLatestBusinessCardImage, normalizeBusinessCardImages } from "@/lib/businessCardImages";
import { getOptimizedImageUrl } from "@/lib/imageUtils";

type Props = {
  place: {
    id: string;
    name: string;
    address: string;
    rating: number | null;
    booking_price: number;
    images: unknown;
  };
  colors: ThemeColors;
  heroTopInset: number;
  isFavorite: boolean;
  onPressBack: () => void;
  onPressFavorite: () => void;
  children?: ReactNode;
};

const HERO_HEIGHT = 260;

export function BookingFlowPlacePanel({
  place,
  colors,
  heroTopInset,
  isFavorite,
  onPressBack,
  onPressFavorite,
  children,
}: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const [heroSlide, setHeroSlide] = useState(0);
  const heroWidth = Math.max(280, windowWidth);

  const stylesThemed = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          marginBottom: 16,
        },
        heroWrap: {
          width: heroWidth,
          height: HERO_HEIGHT,
          overflow: "hidden",
          backgroundColor: colors.border,
          alignSelf: "center",
        },
        hero: {
          width: "100%",
          height: "100%",
        },
        heroBar: {
          position: "absolute",
          left: 12,
          right: 12,
          top: heroTopInset,
          flexDirection: "row",
          justifyContent: "space-between",
        },
        iconBtn: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: "rgba(255,255,255,0.92)",
          alignItems: "center",
          justifyContent: "center",
        },
        iconText: {
          fontSize: 18,
          color: "#111",
          fontWeight: "700",
        },
        dotsRow: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 10,
          flexDirection: "row",
          justifyContent: "center",
          gap: 6,
        },
        dot: {
          width: 7,
          height: 7,
          borderRadius: 3.5,
          backgroundColor: "rgba(255,255,255,0.45)",
        },
        dotActive: {
          backgroundColor: "rgba(255,255,255,0.95)",
        },
        detailsCard: {
          marginTop: -24,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          padding: 20,
        },
        title: {
          fontSize: 22,
          fontWeight: "800",
          color: colors.text,
        },
        rating: {
          marginTop: 6,
          color: colors.textMuted,
          fontSize: 14,
        },
        address: {
          marginTop: 10,
          color: colors.text,
        },
        childrenWrap: {
          marginTop: 14,
        },
      }),
    [colors, heroTopInset, heroWidth],
  );

  const heroImagesRaw = useMemo(
    () => normalizeBusinessCardImages(place.images).filter((url, idx, arr) => arr.indexOf(url) === idx),
    [place.images],
  );
  const heroImages = useMemo(
    () => heroImagesRaw.map((url) => getOptimizedImageUrl(url, 900, 560) || url),
    [heroImagesRaw],
  );
  const heroFallback = useMemo(() => getLatestBusinessCardImage(place.images), [place.images]);

  return (
    <View style={stylesThemed.wrap}>
      <View style={stylesThemed.heroWrap}>
        {heroImages.length > 1 ? (
          <>
            <Carousel
              width={heroWidth}
              height={HERO_HEIGHT}
              data={heroImages}
              loop={false}
              onSnapToItem={setHeroSlide}
              renderItem={({ item, index }) => (
                <SmartImage
                  uri={item}
                  fallbackUri={heroImagesRaw[index] ?? null}
                  recyclingKey={`${place.id}-booking-panel-${index}`}
                  style={stylesThemed.hero}
                  contentFit="cover"
                  transition={200}
                />
              )}
            />
            <View style={stylesThemed.dotsRow}>
              {heroImages.map((_, idx) => (
                <View key={`${place.id}-booking-panel-dot-${idx}`} style={[stylesThemed.dot, heroSlide === idx && stylesThemed.dotActive]} />
              ))}
            </View>
          </>
        ) : (
          <SmartImage
            uri={heroImages[0] ?? heroFallback}
            fallbackUri={heroImagesRaw[0] ?? null}
            recyclingKey={`${place.id}-booking-panel`}
            style={stylesThemed.hero}
            contentFit="cover"
            transition={200}
          />
        )}
        <View style={stylesThemed.heroBar}>
          <Pressable style={stylesThemed.iconBtn} onPress={onPressBack}>
            <Text style={stylesThemed.iconText}>←</Text>
          </Pressable>
          <Pressable style={stylesThemed.iconBtn} onPress={onPressFavorite}>
            <Text style={stylesThemed.iconText}>{isFavorite ? "♥" : "♡"}</Text>
          </Pressable>
        </View>
      </View>

      <View style={stylesThemed.detailsCard}>
        <Text style={stylesThemed.title}>{place.name}</Text>
        <Text style={stylesThemed.rating}>
          {Number(place.rating ?? 0).toFixed(1)} · {Number(place.booking_price).toLocaleString()} $
        </Text>
        <Text style={stylesThemed.address}>📍 {place.address}</Text>
        {children ? <View style={stylesThemed.childrenWrap}>{children}</View> : null}
      </View>
    </View>
  );
}
