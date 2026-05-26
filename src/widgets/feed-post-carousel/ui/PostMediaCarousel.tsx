import { memo, useCallback, useEffect, useState } from "react";
import { InteractionManager, StyleSheet, View } from "react-native";
import Carousel, { type CarouselRenderItem } from "react-native-reanimated-carousel";
import { preloadSmartImages } from "@/shared/ui/smart-image/SmartImage";
import { StoryMediaSlide } from "@/widgets/stories-strip";
import { configureFeedCarouselPanGesture } from "../lib/configureFeedCarouselPanGesture";

const carouselStyles = StyleSheet.create({
  sliderDots: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 10,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  sliderDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});

const PostCarouselSlide = memo(function PostCarouselSlide({
  imageUri,
  fallbackUri,
  recyclingKey,
  sliderHeight,
  blurhash,
}: {
  imageUri: string;
  fallbackUri: string | null;
  recyclingKey: string;
  sliderHeight: number;
  blurhash?: string | null;
}) {
  return (
    <SmartImage
      uri={imageUri}
      fallbackUri={fallbackUri}
      blurhash={blurhash ?? undefined}
      recyclingKey={recyclingKey}
      style={[carouselStyles.sliderImage, { height: sliderHeight }]}
      contentFit="cover"
      transition={85}
    />
  );
});

export const PostMediaCarousel = memo(function PostMediaCarousel({
  postId,
  postImages,
  postImagesRaw,
  postSlideBlurhashes,
  width,
  sliderHeight,
}: {
  postId: string;
  postImages: string[];
  postImagesRaw: string[];
  postSlideBlurhashes: (string | null)[];
  width: number;
  sliderHeight: number;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (postImages.length === 0) return;
    const neighborIdx = [activeIndex - 1, activeIndex, activeIndex + 1].filter(
      (i) => i >= 0 && i < postImages.length,
    );
    const uris = neighborIdx.map((i) => postImages[i]).filter((u): u is string => Boolean(u));
    const task = InteractionManager.runAfterInteractions(() => {
      void preloadSmartImages(uris);
    });
    return () => task.cancel();
  }, [activeIndex, postImages, postImagesRaw]);

  const renderCarouselItem = useCallback<CarouselRenderItem<string>>(
    ({ item: imageUri, index }) => (
      <StoryMediaSlide
        optimizedUri={imageUri}
        fallbackUri={postImagesRaw[index] ?? null}
        blurhash={postSlideBlurhashes[index] ?? null}
        recyclingKey={`${postId}-feed-slider-${index}`}
        width={width}
        height={sliderHeight}
      />
    ),
    [postId, postImagesRaw, postSlideBlurhashes, sliderHeight, width],
  );

  return (
    <View>
      <Carousel
        width={width}
        height={sliderHeight}
        data={postImages}
        loop
        autoPlay
        autoPlayInterval={5000}
        scrollAnimationDuration={650}
        onConfigurePanGesture={configureFeedCarouselPanGesture}
        onSnapToItem={setActiveIndex}
        renderItem={renderCarouselItem}
      />
      <View style={carouselStyles.sliderDots}>
        {postImages.map((_, idx) => (
          <View
            key={`${postId}-dot-${idx}`}
            style={[
              carouselStyles.sliderDot,
              { backgroundColor: activeIndex === idx ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.45)" },
            ]}
          />
        ))}
      </View>
    </View>
  );
});
