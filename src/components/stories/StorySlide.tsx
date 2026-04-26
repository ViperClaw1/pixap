import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { SmartImage } from "@/components/SmartImage";
import { useAppTheme } from "@/contexts/ThemeContext";
import type { StoryItem } from "@/types/stories";

interface StorySlideProps {
  story: StoryItem;
  width: number;
  height: number;
}

function StorySlideComponent({ story, width, height }: StorySlideProps) {
  const { colors } = useAppTheme();
  const hasMedia = !!story.media_url;

  return (
    <View style={[styles.container, { width, height, backgroundColor: colors.background }]}>
      {hasMedia ? (
        <SmartImage
          uri={story.media_url}
          style={styles.media}
          contentFit="cover"
          allowDownscaling={false}
          cachePolicy="memory-disk"
          priority="high"
          transition={120}
          recyclingKey={`story-media-${story.id}`}
        />
      ) : (
        <View style={[styles.mediaFallback, { backgroundColor: colors.card }]} />
      )}
    </View>
  );
}

export const StorySlide = memo(StorySlideComponent);

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  media: {
    width: "100%",
    height: "100%",
  },
  mediaFallback: {
    width: "100%",
    height: "100%",
  },
});
