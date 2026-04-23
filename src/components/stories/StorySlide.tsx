import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
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
          transition={160}
          recyclingKey={`story-media-${story.id}`}
        />
      ) : (
        <View style={[styles.mediaFallback, { backgroundColor: colors.card }]} />
      )}
      <View style={styles.overlay}>
        <Text style={styles.content} numberOfLines={6}>
          {story.content}
        </Text>
      </View>
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
  overlay: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 18,
  },
  content: {
    color: "#fff",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
});
