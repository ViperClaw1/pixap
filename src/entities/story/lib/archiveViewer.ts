import type { StoryItem } from "@/types/stories";

export function rotateStoriesFromIndex(stories: StoryItem[], startIndex: number): StoryItem[] {
  if (!stories.length) return [];
  const safeStartIndex = Math.max(0, Math.min(startIndex, stories.length - 1));
  if (safeStartIndex === 0) return stories;
  return [...stories.slice(safeStartIndex), ...stories.slice(0, safeStartIndex)];
}

