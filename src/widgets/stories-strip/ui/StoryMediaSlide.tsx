import { memo, useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";

export const STORY_MEDIA_FALLBACK_BG = "#26262a";
const STORY_MEDIA_SPINNER_COLOR = "#ffffff";

export interface StoryMediaSlideProps {
  optimizedUri?: string | null;
  fallbackUri?: string | null;
  recyclingKey: string;
  width: number;
  height: number;
}

function StoryMediaSlideComponent({
  optimizedUri,
  fallbackUri,
  recyclingKey,
  width,
  height,
}: StoryMediaSlideProps) {
  const primaryUri = optimizedUri?.trim() || fallbackUri?.trim() || null;
  const hasMedia = Boolean(primaryUri);
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(!hasMedia);

  useEffect(() => {
    setMediaReady(false);
    setMediaFailed(!hasMedia);
  }, [hasMedia, primaryUri, recyclingKey, optimizedUri, fallbackUri]);

  const onMediaLoad = useCallback(() => {
    setMediaReady(true);
    setMediaFailed(false);
  }, []);

  const onMediaSourcesExhausted = useCallback(() => {
    setMediaReady(false);
    setMediaFailed(true);
  }, []);

  const showSpinner = !mediaReady || mediaFailed;

  return (
    <View style={[styles.container, { width, height, backgroundColor: STORY_MEDIA_FALLBACK_BG }]}>
      {showSpinner ? (
        <View style={styles.spinnerWrap} pointerEvents="none">
          <ActivityIndicator size="large" color={STORY_MEDIA_SPINNER_COLOR} />
        </View>
      ) : null}
      {hasMedia && !mediaFailed ? (
        <SmartImage
          uri={optimizedUri || fallbackUri}
          fallbackUri={fallbackUri}
          style={[styles.media, !mediaReady && styles.mediaHidden]}
          contentFit="cover"
          allowDownscaling
          cachePolicy="memory-disk"
          priority="high"
          transition={80}
          recyclingKey={recyclingKey}
          skipBundledPlaceholder
          onLoad={onMediaLoad}
          onSourcesExhausted={onMediaSourcesExhausted}
        />
      ) : null}
    </View>
  );
}

export const StoryMediaSlide = memo(StoryMediaSlideComponent);

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  spinnerWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  media: {
    width: "100%",
    height: "100%",
  },
  mediaHidden: {
    opacity: 0,
  },
});
