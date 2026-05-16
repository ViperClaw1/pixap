import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useBookingFlowPlacePanelStyles } from "./bookingFlowPlacePanelStyles";
import Carousel from "react-native-reanimated-carousel";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { getLatestBusinessCardImage, normalizeBusinessCardImages } from "@/shared/lib/business-card/businessCardImages";
import { getOptimizedImageUrl } from "@/shared/lib/imageUtils";

type Props = {
  place: {
    id: string;
    name: string;
    address: string;
    rating: number | null;
    images: unknown;
  };
  heroTopInset: number;
  isFavorite: boolean;
  onPressBack: () => void;
  onPressFavorite: () => void;
  children?: ReactNode;
  useMonotoneDarkBackground?: boolean;
  /** Stretch white details card to fill remaining screen height. */
  fillContent?: boolean;
};

const HERO_HEIGHT = 260;

export function BookingFlowPlacePanel({
  place,
  heroTopInset,
  isFavorite,
  onPressBack,
  onPressFavorite,
  children,
  useMonotoneDarkBackground = false,
  fillContent = false,
}: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const [heroSlide, setHeroSlide] = useState(0);
  const heroWidth = Math.max(280, windowWidth);

  const styles = useBookingFlowPlacePanelStyles(heroWidth, heroTopInset, useMonotoneDarkBackground);

  const heroImagesRaw = useMemo(
    () => normalizeBusinessCardImages(place.images).filter((url, idx, arr) => arr.indexOf(url) === idx),
    [place.images],
  );
  const heroImages = useMemo(
    () => heroImagesRaw.map((url) => getOptimizedImageUrl(url, 900, 560) || url),
    [heroImagesRaw],
  );
  const heroFallback = useMemo(() => getLatestBusinessCardImage(place.images), [place.images]);

  const renderHeroCarouselItem = useCallback(
    ({ item, index }: { item: string; index: number }) => (
      <SmartImage
        uri={item}
        fallbackUri={heroImagesRaw[index] ?? null}
        recyclingKey={`${place.id}-booking-panel-${index}`}
        style={styles.hero}
        contentFit="cover"
        transition={200}
      />
    ),
    [heroImagesRaw, place.id, styles.hero],
  );

  return (
    <View style={[styles.wrap, fillContent && styles.wrapFill]}>
      <View style={styles.heroWrap}>
        {heroImages.length > 1 ? (
          <>
            <Carousel
              width={heroWidth}
              height={HERO_HEIGHT}
              data={heroImages}
              loop={false}
              onSnapToItem={setHeroSlide}
              renderItem={renderHeroCarouselItem}
            />
            <View style={styles.dotsRow}>
              {heroImages.map((_, idx) => (
                <View key={`${place.id}-booking-panel-dot-${idx}`} style={[styles.dot, heroSlide === idx && styles.dotActive]} />
              ))}
            </View>
          </>
        ) : (
          <SmartImage
            uri={heroImages[0] ?? heroFallback}
            fallbackUri={heroImagesRaw[0] ?? null}
            recyclingKey={`${place.id}-booking-panel`}
            style={styles.hero}
            contentFit="cover"
            transition={200}
          />
        )}
        <View style={styles.heroBar}>
          <Pressable style={styles.iconBtn} onPress={onPressBack}>
            <Text style={styles.iconText}>←</Text>
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={onPressFavorite}>
            <Text style={styles.iconText}>{isFavorite ? "♥" : "♡"}</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.detailsCard, fillContent && styles.detailsCardFill]}>
        <Text style={styles.title}>{place.name}</Text>
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={14} color="#eab308" />
          <Text style={styles.rating}>{Number(place.rating ?? 0).toFixed(1)}</Text>
        </View>
        <Text style={styles.address}>📍 {place.address}</Text>
        {children ? <View style={styles.childrenWrap}>{children}</View> : null}
      </View>
    </View>
  );
}
