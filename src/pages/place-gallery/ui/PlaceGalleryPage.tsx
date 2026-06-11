import { useStaticWindowSize } from "@/shared/lib/useStaticWindowSize";
import { AppPressable } from "@/shared/ui/app-pressable";
import { useCallback, useEffect, useMemo, useState } from "react";
import { InteractionManager, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, useIsFocused, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cancelAnimation, useSharedValue, withTiming, Easing } from "react-native-reanimated";
import Carousel from "react-native-reanimated-carousel";
import type { BrowseFlowParamList } from "@/app/navigation/types";
import { preloadSmartImages, SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { StoryProgressBar } from "@/shared/ui/story-progress-bar";
import { getBusinessCardDisplayUrl } from "@/shared/lib/business-card/businessCardDisplayUrl";
import { isBusinessCardsStorageUrl } from "@/shared/lib/business-card/businessCardPregenStorage";
import {
  useDeleteVenuePhoto,
  VenuePhotoDeleteButton,
  VenuePhotoDeleteConfirmModal,
} from "@/features/venue-photo-upload";

const AUTO_SLIDE_MS = 5000;

type PlaceGalleryRoute = RouteProp<BrowseFlowParamList, "PlaceGallery">;
type PlaceGalleryNav = NativeStackNavigationProp<BrowseFlowParamList, "PlaceGallery">;

function uniqueStrings(values: string[]): string[] {
  return values.filter((value, index, arr) => arr.indexOf(value) === index);
}

function isValidImageSource(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === "null" || normalized === "undefined" || normalized === "nan") return false;
  if (normalized === "[object object]") return false;
  return (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("file://") ||
    normalized.startsWith("content://") ||
    normalized.startsWith("data:image/") ||
    normalized.startsWith("blob:") ||
    normalized.startsWith("/")
  );
}

export default function PlaceGalleryPage() {
  const { params } = useRoute<PlaceGalleryRoute>();
  const navigation = useNavigation<PlaceGalleryNav>();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isScreenFocused = useIsFocused();
  const { width, height } = useStaticWindowSize();
  const { deletePhoto, deleting, canDeletePhoto } = useDeleteVenuePhoto(params.placeId);

  const initialImages = useMemo(
    () => uniqueStrings(params.images.filter((item) => item.trim().length > 0 && isValidImageSource(item))),
    [params.images],
  );
  const initialRawImages = useMemo(
    () =>
      uniqueStrings(
        (params.rawImages ?? initialImages).filter((item) => item.trim().length > 0 && isValidImageSource(item)),
      ),
    [initialImages, params.rawImages],
  );

  const [images, setImages] = useState(initialImages);
  const [rawImages, setRawImages] = useState(initialRawImages);
  const [pendingDeleteUrl, setPendingDeleteUrl] = useState<string | null>(null);

  useEffect(() => {
    setImages(initialImages);
    setRawImages(initialRawImages);
  }, [initialImages, initialRawImages]);

  const initialIndex = useMemo(() => {
    if (images.length === 0) return 0;
    return Math.max(0, Math.min(params.initialIndex ?? 0, images.length - 1));
  }, [images.length, params.initialIndex]);

  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [holdPaused, setHoldPaused] = useState(false);
  const [carouselDragging, setCarouselDragging] = useState(false);
  const progress = useSharedValue(0);

  const progressPaused = holdPaused || carouselDragging;

  const activeRawImage = rawImages[activeIndex] ?? images[activeIndex] ?? null;
  const showDelete = activeRawImage ? canDeletePhoto(activeRawImage) : false;

  const galleryUri = useCallback((rawOrDisplay: string) => {
    if (isBusinessCardsStorageUrl(rawOrDisplay)) {
      return getBusinessCardDisplayUrl(rawOrDisplay, { size: "gallery" }) ?? rawOrDisplay;
    }
    return rawOrDisplay;
  }, []);

  const restartProgress = useCallback(() => {
    cancelAnimation(progress);
    progress.value = 0;
    if (progressPaused || images.length <= 1) {
      progress.value = images.length <= 1 ? 1 : 0;
      return;
    }
    progress.value = withTiming(1, { duration: AUTO_SLIDE_MS, easing: Easing.linear });
  }, [images.length, progress, progressPaused]);

  useEffect(() => {
    restartProgress();
    return () => {
      cancelAnimation(progress);
    };
  }, [activeIndex, progressPaused, restartProgress]);

  useEffect(() => {
    if (images.length === 0) navigation.goBack();
  }, [images.length, navigation]);

  useEffect(() => {
    if (activeIndex >= images.length && images.length > 0) {
      setActiveIndex(Math.max(0, images.length - 1));
    }
  }, [activeIndex, images.length]);

  useEffect(() => {
    if (images.length === 0) return;
    const idxs = [activeIndex - 1, activeIndex, activeIndex + 1].filter((i) => i >= 0 && i < images.length);
    const uris = idxs.map((i) => galleryUri(rawImages[i] ?? images[i]));
    const task = InteractionManager.runAfterInteractions(() => {
      void preloadSmartImages(uris);
    });
    return () => task.cancel();
  }, [activeIndex, galleryUri, images, rawImages]);

  const handleSnapToItem = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  const handleDeleteRequest = useCallback(() => {
    if (!activeRawImage) return;
    setPendingDeleteUrl(activeRawImage);
  }, [activeRawImage]);

  const handleConfirmDelete = useCallback(() => {
    if (!pendingDeleteUrl) return;
    const target = pendingDeleteUrl;
    void deletePhoto(target).then((ok) => {
      if (!ok) return;
      setRawImages((prevRaw) => {
        const deleteIndex = prevRaw.findIndex((url) => url === target);
        setImages((prevImages) => {
          const next =
            deleteIndex >= 0 ? prevImages.filter((_, index) => index !== deleteIndex) : prevImages;
          setActiveIndex((current) => Math.max(0, Math.min(current, Math.max(0, next.length - 1))));
          return next;
        });
        return prevRaw.filter((url) => url !== target);
      });
      setPendingDeleteUrl(null);
    });
  }, [deletePhoto, pendingDeleteUrl]);

  const renderGalleryItem = useCallback(
    ({ item, index }: { item: string; index: number }) => (
      <AppPressable
        style={styles.absoluteFill}
        onLongPress={() => setHoldPaused(true)}
        onPressOut={() => setHoldPaused(false)}
        delayLongPress={220}
      >
        <SmartImage
          uri={galleryUri(rawImages[index] ?? item)}
          fallbackUri={rawImages[index] ?? item}
          recyclingKey={`place-gallery-${rawImages[index] ?? item}`}
          style={styles.absoluteFill}
          contentFit="contain"
          transition={100}
          skipBundledPlaceholder
          showLoadingSpinner
          loadingSpinnerColor="#ffffff"
        />
      </AppPressable>
    ),
    [galleryUri, rawImages],
  );

  const canLoop = images.length > 1;

  return (
    <View style={styles.root}>
      <View style={styles.absoluteFill}>
        <Carousel
          width={width}
          height={height}
          data={images}
          loop={canLoop}
          autoPlay={isScreenFocused && canLoop && !progressPaused}
          autoPlayInterval={AUTO_SLIDE_MS}
          enabled
          defaultIndex={initialIndex}
          scrollAnimationDuration={500}
          onScrollStart={() => setCarouselDragging(true)}
          onScrollEnd={() => setCarouselDragging(false)}
          onSnapToItem={handleSnapToItem}
          renderItem={renderGalleryItem}
        />
      </View>

      <View style={[styles.topRow, { top: Math.max(8, insets.top + 8) }]} pointerEvents="box-none">
        <AppPressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={22} color="#111111" />
        </AppPressable>
        <View style={styles.topProgressWrap}>
          <StoryProgressBar count={Math.max(1, images.length)} currentIndex={activeIndex} progress={progress} />
        </View>
        {showDelete ? (
          <VenuePhotoDeleteButton
            variant="gallery"
            accessibilityLabel={t("placePhotoGrid.deletePhotoA11y")}
            onPress={handleDeleteRequest}
          />
        ) : (
          <View style={styles.rightSpacer} />
        )}
      </View>

      <VenuePhotoDeleteConfirmModal
        visible={pendingDeleteUrl != null}
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setPendingDeleteUrl(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
  },
  absoluteFill: {
    ...StyleSheet.absoluteFillObject,
  },
  topRow: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topProgressWrap: {
    width: "70%",
    alignSelf: "center",
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  rightSpacer: {
    width: 42,
    height: 42,
  },
});
