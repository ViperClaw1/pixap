import { useStaticWindowSize } from "@/shared/lib/useStaticWindowSize";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  BOOKING_FLOW_HERO_HEIGHT,
  BOOKING_HERO_OVERLAY_ICON_COLOR,
  useBookingFlowPlacePanelStyles,
} from "./bookingFlowPlacePanelStyles";
import Carousel from "react-native-reanimated-carousel";
import { PLACE_IMAGE_FALLBACK } from "@/shared/assets/placeImageFallback";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { AppPressable } from "@/shared/ui/app-pressable";
import { StoryProgressBar } from "@/shared/ui/story-progress-bar";
import { getPrimaryBusinessCardImage, normalizeBusinessCardImages } from "@/shared/lib/business-card/businessCardImages";
import {
  businessCardDisplayFallback,
  getBusinessCardDisplayUrls,
} from "@/shared/lib/business-card/businessCardDisplayUrl";

type Props = {
  place: {
    id: string;
    name: string;
    address: string;
    rating: number | null;
    images: unknown;
  };
  isFavorite: boolean;
  onPressBack: () => void;
  onPressFavorite: () => void;
  children?: ReactNode;
  useMonotoneDarkBackground?: boolean;
  /** Stretch white details card to fill remaining screen height. */
  fillContent?: boolean;
};

const AUTO_SLIDE_MS = 5000;

export function BookingFlowPlacePanel({
  place,
  isFavorite,
  onPressBack,
  onPressFavorite,
  children,
  useMonotoneDarkBackground = false,
  fillContent = false,
}: Props) {
  const isScreenFocused = useIsFocused();
  const { width: windowWidth } = useStaticWindowSize();
  const [heroSlide, setHeroSlide] = useState(0);
  const progress = useSharedValue(0);
  const heroWidth = Math.max(280, windowWidth);

  const styles = useBookingFlowPlacePanelStyles(useMonotoneDarkBackground);

  const heroImagesRaw = useMemo(
    () => normalizeBusinessCardImages(place.images).filter((url, idx, arr) => arr.indexOf(url) === idx),
    [place.images],
  );
  const heroImages = useMemo(
    () => getBusinessCardDisplayUrls(heroImagesRaw, { size: "hero" }),
    [heroImagesRaw],
  );
  const heroFallback = useMemo(() => getPrimaryBusinessCardImage(place.images), [place.images]);

  const restartHeroProgress = useCallback(() => {
    cancelAnimation(progress);
    progress.value = 0;
    if (heroImages.length <= 1) {
      progress.value = 1;
      return;
    }
    progress.value = withTiming(1, { duration: AUTO_SLIDE_MS, easing: Easing.linear });
  }, [heroImages.length, progress]);

  useEffect(() => {
    restartHeroProgress();
    return () => cancelAnimation(progress);
  }, [heroSlide, progress, restartHeroProgress]);

  const renderHeroCarouselItem = useCallback(
    ({ item, index }: { item: string; index: number }) => (
      <SmartImage
        uri={item}
        fallbackUri={businessCardDisplayFallback(item, heroImagesRaw[index])}
        bundledFallback={PLACE_IMAGE_FALLBACK}
        recyclingKey={`${place.id}-booking-panel-${index}`}
        style={styles.hero}
        contentFit="cover"
        transition={200}
      />
    ),
    [heroImagesRaw, place.id, styles.hero],
  );

  const heroChrome = (
    <SafeAreaView edges={["top"]} style={styles.heroChrome} pointerEvents="box-none">
      {heroImages.length > 1 ? (
        <View style={styles.heroProgressWrap} pointerEvents="none">
          <StoryProgressBar count={heroImages.length} currentIndex={heroSlide} progress={progress} />
        </View>
      ) : null}
      <View style={styles.heroBar} pointerEvents="box-none">
        <AppPressable style={styles.heroBackBtn} onPress={onPressBack} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={20} color={BOOKING_HERO_OVERLAY_ICON_COLOR} />
        </AppPressable>
        <View style={styles.heroBarActions}>
          <AppPressable style={styles.iconBtn} onPress={onPressFavorite} accessibilityLabel="Favorite">
            <Ionicons
              name={isFavorite ? "heart" : "heart-outline"}
              size={18}
              color={BOOKING_HERO_OVERLAY_ICON_COLOR}
            />
          </AppPressable>
        </View>
      </View>
    </SafeAreaView>
  );

  return (
    <View style={[styles.wrap, fillContent && styles.wrapFill]}>
      <View style={styles.heroWrap}>
        {heroImages.length > 1 ? (
          <Carousel
            width={heroWidth}
            height={BOOKING_FLOW_HERO_HEIGHT}
            data={heroImages}
            loop
            autoPlay={isScreenFocused && heroImages.length > 1}
            autoPlayInterval={AUTO_SLIDE_MS}
            scrollAnimationDuration={500}
            onSnapToItem={setHeroSlide}
            renderItem={renderHeroCarouselItem}
          />
        ) : (
          <SmartImage
            uri={heroImages[0] ?? heroFallback}
            fallbackUri={heroImagesRaw[0] ?? null}
            bundledFallback={PLACE_IMAGE_FALLBACK}
            recyclingKey={`${place.id}-booking-panel`}
            style={styles.hero}
            contentFit="cover"
            transition={200}
          />
        )}
        {heroChrome}
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
