import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InteractionManager, Text, View, useWindowDimensions } from "react-native";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Easing, cancelAnimation, useSharedValue, withTiming } from "react-native-reanimated";
import Carousel from "react-native-reanimated-carousel";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import type { BrowseFlowParamList } from "@/app/navigation/types";
import { useBusinessCard } from "@/entities/business-card";
import type { PixAIPlace } from "@/entities/pixai";
import { PLACE_IMAGE_FALLBACK } from "@/shared/assets/placeImageFallback";
import { resolveBusinessCardHeroImagesRaw } from "@/shared/lib/business-card/businessCardImages";
import {
  businessCardDisplayFallback,
  getBusinessCardDisplayUrl,
  getBusinessCardDisplayUrls,
} from "@/shared/lib/business-card/businessCardDisplayUrl";
import { getBusinessCardCoverBlurhash } from "@/shared/lib/business-card/businessCardBlurhash";
import { AppPressable } from "@/shared/ui/app-pressable";
import { SmartImage, preloadSmartImages } from "@/shared/ui/smart-image/SmartImage";
import { StoryProgressBar } from "@/shared/ui/story-progress-bar";
import type { AIBookingStyles } from "./aiBookingStyles";

const AUTO_SLIDE_MS = 5000;
const DOUBLE_TAP_DELAY_MS = 260;

type Nav = NativeStackNavigationProp<BrowseFlowParamList>;

type Props = {
  styles: AIBookingStyles;
  selectedPlace: PixAIPlace;
};

export function AIBookingSelectedPlaceDetails({ styles: s, selectedPlace }: Props) {
  const navigation = useNavigation<Nav>();
  const isScreenFocused = useIsFocused();
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const { data: fullPlace } = useBusinessCard(selectedPlace.id);
  const place = fullPlace ?? selectedPlace;
  const [heroSlide, setHeroSlide] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const progress = useSharedValue(0);
  const lastTapRef = useRef<{ at: number; index: number } | null>(null);
  const heroWidth = Math.max(260, windowWidth - 58);

  const imageVm = useMemo(() => {
    const { heroImagesRaw, heroFallback } = resolveBusinessCardHeroImagesRaw(place);
    const heroImages = getBusinessCardDisplayUrls(heroImagesRaw, { size: "hero" });
    const fallbackGalleryImages = heroFallback ? [heroFallback] : [];
    const galleryRaw = heroImagesRaw.length > 0 ? heroImagesRaw : fallbackGalleryImages;
    return {
      heroImagesRaw,
      heroImages,
      heroFallback: heroFallback ? getBusinessCardDisplayUrl(heroFallback, { size: "hero" }) : null,
      galleryImages: galleryRaw,
      galleryFallbacks: galleryRaw,
      gridThumbImages: getBusinessCardDisplayUrls(galleryRaw, { size: "list" }),
    };
  }, [place]);

  const restartHeroProgress = useCallback(() => {
    cancelAnimation(progress);
    progress.value = 0;
    if (heroPaused || imageVm.heroImages.length <= 1) {
      progress.value = imageVm.heroImages.length <= 1 ? 1 : 0;
      return;
    }
    progress.value = withTiming(1, { duration: AUTO_SLIDE_MS, easing: Easing.linear });
  }, [heroPaused, imageVm.heroImages.length, progress]);

  useEffect(() => {
    restartHeroProgress();
    return () => cancelAnimation(progress);
  }, [heroSlide, heroPaused, progress, restartHeroProgress]);

  useEffect(() => {
    const preloadCandidates = imageVm.heroImages.slice(0, 4);
    if (!preloadCandidates.length) return;
    let cancelled = false;
    let task: { cancel: () => void } | null = null;
    const timer = setTimeout(() => {
      task = InteractionManager.runAfterInteractions(() => {
        if (!cancelled) void preloadSmartImages(preloadCandidates);
      });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      task?.cancel();
    };
  }, [imageVm.heroImages]);

  const openFullscreenGallery = useCallback(
    (initialIndex: number) => {
      navigation.navigate("PlaceGallery", {
        images: imageVm.galleryImages,
        rawImages: imageVm.galleryFallbacks,
        initialIndex,
      });
    },
    [imageVm.galleryFallbacks, imageVm.galleryImages, navigation],
  );

  const openPhotoGrid = useCallback(() => {
    navigation.navigate("PlacePhotoGrid", {
      title: place.name,
      images: imageVm.gridThumbImages,
      rawImages: imageVm.galleryFallbacks,
    });
  }, [imageVm.galleryFallbacks, imageVm.gridThumbImages, navigation, place.name]);

  const handleHeroTap = useCallback(
    (index: number) => {
      const now = Date.now();
      const prev = lastTapRef.current;
      if (prev && prev.index === index && now - prev.at <= DOUBLE_TAP_DELAY_MS) {
        lastTapRef.current = null;
        openFullscreenGallery(index);
        return;
      }
      lastTapRef.current = { at: now, index };
    },
    [openFullscreenGallery],
  );

  const renderHeroItem = useCallback(
    ({ item, index }: { item: string; index: number }) => (
      <AppPressable
        onPress={() => handleHeroTap(index)}
        onLongPress={() => setHeroPaused(true)}
        onPressOut={() => setHeroPaused(false)}
        delayLongPress={220}
      >
        <SmartImage
          uri={item}
          fallbackUri={businessCardDisplayFallback(item, imageVm.heroImagesRaw[index]) ?? null}
          bundledFallback={PLACE_IMAGE_FALLBACK}
          blurhash={getBusinessCardCoverBlurhash(place.blurhashes)}
          recyclingKey={`${place.id}-ai-booking-hero-${index}`}
          style={s.selectedPlaceHero}
          contentFit="cover"
          showLoadingSpinner
          skipBundledPlaceholder
          loadingSpinnerColor={colors.primary}
        />
      </AppPressable>
    ),
    [colors.primary, handleHeroTap, imageVm.heroImagesRaw, place.blurhashes, place.id, s.selectedPlaceHero],
  );

  const tags = (place.tags ?? []).map((tag) => tag.trim()).filter(Boolean);
  const address = place.address?.trim();
  const phone = fullPlace?.phone.trim();
  const description = fullPlace?.description.trim();
  const singleHeroUri = imageVm.heroImages[0] ?? imageVm.heroFallback;

  return (
    <View style={s.semanticSection}>
      <View style={s.selectedPlaceHeroWrap}>
        {imageVm.heroImages.length > 1 ? (
          <>
            <Carousel
              width={heroWidth}
              height={220}
              data={imageVm.heroImages}
              loop
              autoPlay={isScreenFocused && imageVm.heroImages.length > 1}
              autoPlayInterval={AUTO_SLIDE_MS}
              enabled={!heroPaused}
              scrollAnimationDuration={500}
              onSnapToItem={setHeroSlide}
              renderItem={renderHeroItem}
            />
            <View style={s.selectedPlaceHeroProgressWrap}>
              <StoryProgressBar count={imageVm.heroImages.length} currentIndex={heroSlide} progress={progress} />
            </View>
            <View style={s.selectedPlaceHeroDotsRow}>
              {imageVm.heroImages.map((_, idx) => (
                <View
                  key={`${place.id}-ai-booking-hero-dot-${idx}`}
                  style={[s.selectedPlaceHeroDot, heroSlide === idx && s.selectedPlaceHeroDotActive]}
                />
              ))}
            </View>
            <View style={s.selectedPlaceHeroSeeAllRow} pointerEvents="box-none">
              <AppPressable
                style={s.selectedPlaceHeroSeeAllBadge}
                onPress={openPhotoGrid}
                accessibilityRole="button"
                accessibilityLabel={t("placeDetail.seeAllPhotosA11y", {
                  count: imageVm.heroImages.length,
                })}
              >
                <Text style={s.selectedPlaceHeroSeeAllBadgeText}>
                  {t("placeDetail.seeAllPhotos", { count: imageVm.heroImages.length })}
                </Text>
              </AppPressable>
            </View>
          </>
        ) : (
          <AppPressable
            onPress={() => handleHeroTap(0)}
            onLongPress={() => setHeroPaused(true)}
            onPressOut={() => setHeroPaused(false)}
            delayLongPress={220}
          >
            <SmartImage
              uri={singleHeroUri}
              fallbackUri={businessCardDisplayFallback(singleHeroUri, imageVm.heroImagesRaw[0]) ?? null}
              bundledFallback={PLACE_IMAGE_FALLBACK}
              blurhash={getBusinessCardCoverBlurhash(place.blurhashes)}
              recyclingKey={`${place.id}-ai-booking-hero`}
              style={s.selectedPlaceHero}
              contentFit="cover"
              showLoadingSpinner
              skipBundledPlaceholder={Boolean(singleHeroUri)}
              loadingSpinnerColor={colors.primary}
            />
          </AppPressable>
        )}
      </View>

      <View style={s.selectedPlaceInfo}>
        <Text style={s.selectedPlaceTitle}>{place.name}</Text>
        {address ? (
          <Text style={s.selectedPlaceMetaText}>
            <Ionicons name="location-outline" size={14} color={colors.textMuted} /> {address}
          </Text>
        ) : null}
        {phone ? (
          <Text style={s.selectedPlaceMetaText}>
            <Ionicons name="call-outline" size={14} color={colors.textMuted} /> {phone}
          </Text>
        ) : null}
        {tags.length > 0 ? (
          <View style={s.selectedPlaceTagsRow}>
            {tags.map((tag) => (
              <Text key={tag} style={s.selectedPlaceTag}>
                {tag}
              </Text>
            ))}
          </View>
        ) : null}
        {description ? <Text style={s.selectedPlaceDescription}>{description}</Text> : null}
      </View>
    </View>
  );
}
