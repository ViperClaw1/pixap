import { useCallback, useMemo, useState } from "react";
import type { StoryGroup, StoryItem } from "@/types/stories";

interface Params {
  groups: StoryGroup[];
  initialGroupIndex: number;
  initialStoryIndex: number;
  loop?: boolean;
}

function clamp(value: number, max: number) {
  if (max < 0) return 0;
  return Math.max(0, Math.min(value, max));
}

export const useStoryViewer = ({ groups, initialGroupIndex, initialStoryIndex, loop = false }: Params) => {
  const [currentGroupIndex, setCurrentGroupIndex] = useState(initialGroupIndex);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(initialStoryIndex);
  const [paused, setPaused] = useState(false);

  const activeGroup = groups[currentGroupIndex];
  const activeStory = activeGroup?.stories[currentStoryIndex] ?? null;

  const setCurrent = useCallback(
    (nextGroupIndex: number, nextStoryIndex: number) => {
      const groupIndex = clamp(nextGroupIndex, groups.length - 1);
      const group = groups[groupIndex];
      const storyIndex = clamp(nextStoryIndex, (group?.stories.length ?? 1) - 1);
      setCurrentGroupIndex(groupIndex);
      setCurrentStoryIndex(storyIndex);
    },
    [groups],
  );

  const goToNextStory = useCallback(() => {
    if (!activeGroup) return false;
    if (currentStoryIndex < activeGroup.stories.length - 1) {
      setCurrentStoryIndex((prev) => prev + 1);
      return true;
    }
    if (currentGroupIndex < groups.length - 1) {
      setCurrentGroupIndex((prev) => prev + 1);
      setCurrentStoryIndex(0);
      return true;
    }
    if (loop && groups.length > 0) {
      setCurrentGroupIndex(0);
      setCurrentStoryIndex(0);
      return true;
    }
    return false;
  }, [activeGroup, currentGroupIndex, currentStoryIndex, groups.length, loop]);

  const goToPreviousStory = useCallback(() => {
    if (!activeGroup) return false;
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex((prev) => prev - 1);
      return true;
    }
    if (currentGroupIndex > 0) {
      const previousGroupIndex = currentGroupIndex - 1;
      const previousGroup = groups[previousGroupIndex];
      setCurrentGroupIndex(previousGroupIndex);
      setCurrentStoryIndex(Math.max(0, previousGroup.stories.length - 1));
      return true;
    }
    if (loop && groups.length > 0) {
      const lastGroupIndex = Math.max(0, groups.length - 1);
      const lastGroup = groups[lastGroupIndex];
      setCurrentGroupIndex(lastGroupIndex);
      setCurrentStoryIndex(Math.max(0, (lastGroup?.stories.length ?? 1) - 1));
      return true;
    }
    return false;
  }, [activeGroup, currentGroupIndex, currentStoryIndex, groups, loop]);

  const goToNextGroup = useCallback(() => {
    if (currentGroupIndex >= groups.length - 1) {
      if (!loop || groups.length === 0) return false;
      setCurrentGroupIndex(0);
      setCurrentStoryIndex(0);
      return true;
    }
    setCurrentGroupIndex((prev) => prev + 1);
    setCurrentStoryIndex(0);
    return true;
  }, [currentGroupIndex, groups.length, loop]);

  const goToPreviousGroup = useCallback(() => {
    if (currentGroupIndex <= 0) {
      if (!loop || groups.length === 0) return false;
      const lastGroupIndex = Math.max(0, groups.length - 1);
      setCurrentGroupIndex(lastGroupIndex);
      setCurrentStoryIndex(0);
      return true;
    }
    const nextIndex = currentGroupIndex - 1;
    setCurrentGroupIndex(nextIndex);
    setCurrentStoryIndex(0);
    return true;
  }, [currentGroupIndex, groups.length, loop]);

  const flatStories = useMemo(
    () =>
      groups.flatMap((group, groupIndex) =>
        group.stories.map((story, storyIndex) => ({
          story,
          groupIndex,
          storyIndex,
          key: `${group.user_id}-${story.id}`,
        })),
      ),
    [groups],
  );

  const currentFlatIndex = useMemo(() => {
    const idx = flatStories.findIndex(
      (row) => row.groupIndex === currentGroupIndex && row.storyIndex === currentStoryIndex,
    );
    return idx >= 0 ? idx : 0;
  }, [currentGroupIndex, currentStoryIndex, flatStories]);

  const findByFlatIndex = useCallback(
    (flatIndex: number): { story: StoryItem; groupIndex: number; storyIndex: number } | null => {
      const row = flatStories[flatIndex];
      if (!row) return null;
      return { story: row.story, groupIndex: row.groupIndex, storyIndex: row.storyIndex };
    },
    [flatStories],
  );

  return useMemo(
    () => ({
      currentGroupIndex,
      currentStoryIndex,
      activeGroup,
      activeStory,
      paused,
      setPaused,
      setCurrent,
      goToNextStory,
      goToPreviousStory,
      goToNextGroup,
      goToPreviousGroup,
      flatStories,
      currentFlatIndex,
      findByFlatIndex,
    }),
    [
      activeGroup,
      activeStory,
      currentFlatIndex,
      currentGroupIndex,
      currentStoryIndex,
      findByFlatIndex,
      flatStories,
      goToNextGroup,
      goToNextStory,
      goToPreviousGroup,
      goToPreviousStory,
      paused,
      setCurrent,
    ],
  );
};
