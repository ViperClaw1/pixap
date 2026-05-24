import { memo, useMemo } from "react";
import type { StoryItem } from "@/shared/model/types/stories";
import { getFeedStoryFullscreenImageUrl } from "@/shared/lib/feedMediaUrls";
import { StoryMediaSlide } from "./StoryMediaSlide";

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
  const mediaUrl = parseStoryMediaUrl(story.media_url);
  const optimizedMediaUrl = useMemo(
    () => (mediaUrl ? getFeedStoryFullscreenImageUrl(mediaUrl) : null),
    [mediaUrl],
  );

  return (
    <StoryMediaSlide
      optimizedUri={optimizedMediaUrl}
      fallbackUri={mediaUrl}
      recyclingKey={`story-media-${story.id}`}
      width={width}
      height={height}
    />
  );
}

export const StorySlide = memo(StorySlideComponent);
