import type { StoryItem } from "@/shared/model/types/stories";
import { parseStoryMediaPrimaryUrl, parseStoryMediaUrls } from "@/shared/lib/storyMediaUrls";

export type StoryMediaSlideRow = {
  key: string;
  story: StoryItem;
  mediaIndex: number;
  rawUri: string | null;
};

/** Slides for a single story row — one segment per `media_url` entry. */
export function buildMediaSlidesForStory(story: StoryItem): StoryMediaSlideRow[] {
  const urls = parseStoryMediaUrls(story.media_url);
  if (!urls.length) {
    return [
      {
        key: `${story.id}-0`,
        story,
        mediaIndex: 0,
        rawUri: parseStoryMediaPrimaryUrl(story.media_url),
      },
    ];
  }
  return urls.map((url, mediaIndex) => ({
    key: `${story.id}-${mediaIndex}`,
    story,
    mediaIndex,
    rawUri: url,
  }));
}

export function buildFlatMediaSlides(
  flatStories: { story: StoryItem; groupIndex: number; storyIndex: number }[],
): Array<StoryMediaSlideRow & { groupIndex: number; storyIndex: number }> {
  return flatStories.flatMap((row) =>
    buildMediaSlidesForStory(row.story).map((slide) => ({
      ...slide,
      groupIndex: row.groupIndex,
      storyIndex: row.storyIndex,
    })),
  );
}
