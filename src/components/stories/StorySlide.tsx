import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { useAppTheme } from "@/contexts/ThemeContext";
import type { StoryItem } from "@/types/stories";

interface StorySlideProps {
  story: StoryItem;
  width: number;
  height: number;
}

function parseStoryMediaUrl(raw?: string | null): string | null {
  const value = raw?.trim();
  if (!value) return null;
  if (value.startsWith("[")) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        const first = parsed.find((item) => typeof item === "string" && item.trim().length > 0);
        return typeof first === "string" ? first : null;
      }
    } catch {
      return null;
    }
  }
  return value;
}

function StorySlideComponent({ story, width, height }: StorySlideProps) {
  const { colors } = useAppTheme();
  const mediaUrl = parseStoryMediaUrl(story.media_url);
  const hasMedia = !!mediaUrl;

  return (
    <View style={[styles.container, { width, height, backgroundColor: colors.background }]}>
      {hasMedia ? (
        <SmartImage
          uri={mediaUrl}
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
