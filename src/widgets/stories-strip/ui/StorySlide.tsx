import { memo, useMemo } from "react";
import { PixelRatio } from "react-native";
import type { StoryItem } from "@/shared/model/types/stories";
import { getOptimizedImageUrl, quantizeDecodePx } from "@/shared/lib/imageUtils";
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
  const decodeSize = useMemo(() => {
    const dpr = PixelRatio.get();
    return {
      w: quantizeDecodePx(Math.max(720, Math.round(width * dpr))),
      h: quantizeDecodePx(Math.max(1200, Math.round(height * dpr))),
    };
  }, [width, height]);
  const optimizedMediaUrl = useMemo(
    () => (mediaUrl ? getOptimizedImageUrl(mediaUrl, decodeSize.w, decodeSize.h, 78) : null),
    [mediaUrl, decodeSize.w, decodeSize.h],
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
