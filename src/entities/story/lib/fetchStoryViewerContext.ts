import { supabase } from "@/shared/api/supabase/client";
import { parseMediaBlurhashesColumn } from "@/shared/lib/parseMediaBlurhashesColumn";
import type { StoryGroup, StoryItem, StoryProfile, StoryReactionType } from "@/shared/model/types/stories";

type StoryRow = {
  id: string;
  user_id: string;
  place_id: string | null;
  content: string;
  media_url: string | null;
  media_blurhashes?: unknown;
  created_at: string;
  expiry_time: string;
};

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  username: string | null;
};

function isMissingMediaBlurhashesError(message?: string) {
  return (message ?? "").toLowerCase().includes("media_blurhashes");
}

function groupStories(stories: StoryItem[]): StoryGroup[] {
  const grouped = new Map<string, StoryGroup>();
  for (const story of stories) {
    const existing = grouped.get(story.user_id);
    if (existing) {
      existing.stories.push(story);
      continue;
    }
    grouped.set(story.user_id, {
      user_id: story.user_id,
      profile: story.profile,
      stories: [story],
    });
  }
  return Array.from(grouped.values());
}

async function enrichStories(stories: StoryRow[], viewerUserId: string | null): Promise<StoryItem[]> {
  if (!stories.length) return [];

  const userIds = Array.from(new Set(stories.map((s) => s.user_id)));
  const storyIds = stories.map((s) => s.id);

  const [{ data: profilesData }, { data: commentsData }, { data: reactionsData }, myReactionsResult] =
    await Promise.all([
      supabase.from("public_profiles" as any).select("id, first_name, last_name, avatar_url, username").in("id", userIds),
      supabase.from("story_comments" as any).select("id, story_id").in("story_id", storyIds),
      supabase.from("story_reactions" as any).select("id, story_id").in("story_id", storyIds),
      viewerUserId
        ? supabase.from("story_reactions" as any).select("story_id, type").eq("user_id", viewerUserId).in("story_id", storyIds)
        : Promise.resolve({ data: [] }),
    ]);

  const profiles = new Map<string, StoryProfile>(
    ((profilesData ?? []) as unknown as ProfileRow[]).map((row) => [
      row.id,
      {
        id: row.id,
        first_name: row.first_name,
        last_name: row.last_name,
        avatar_url: row.avatar_url,
        username: row.username,
      },
    ]),
  );

  const commentsCount = new Map<string, number>();
  for (const row of (commentsData ?? []) as unknown as Array<{ story_id: string }>) {
    commentsCount.set(row.story_id, (commentsCount.get(row.story_id) ?? 0) + 1);
  }

  const reactionsCount = new Map<string, number>();
  for (const row of (reactionsData ?? []) as unknown as Array<{ story_id: string }>) {
    reactionsCount.set(row.story_id, (reactionsCount.get(row.story_id) ?? 0) + 1);
  }

  const myReactionsMap = new Map<string, StoryReactionType>();
  for (const row of ((myReactionsResult as { data?: Array<{ story_id: string; type: StoryReactionType }> }).data ??
    []) as Array<{ story_id: string; type: StoryReactionType }>) {
    myReactionsMap.set(row.story_id, row.type);
  }

  return stories.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    place_id: row.place_id,
    content: row.content,
    media_url: row.media_url,
    media_blurhashes: parseMediaBlurhashesColumn(row.media_blurhashes),
    created_at: row.created_at,
    reaction_count: reactionsCount.get(row.id) ?? 0,
    comment_count: commentsCount.get(row.id) ?? 0,
    my_reaction: myReactionsMap.get(row.id) ?? null,
    profile: profiles.get(row.user_id) ?? null,
  }));
}

export type StoryViewerContext = {
  groups: StoryGroup[];
  initialGroupIndex: number;
  initialStoryIndex: number;
  placeId: string;
};

export async function fetchStoryViewerContext(
  storyId: string,
  viewerUserId: string | null,
): Promise<StoryViewerContext | null> {
  const targetId = storyId.trim();
  if (!targetId) return null;

  const storiesSelectWithBlur =
    "id, user_id, place_id, content, media_url, created_at, expiry_time, media_blurhashes";
  const storiesSelectLegacy = "id, user_id, place_id, content, media_url, created_at, expiry_time";

  let { data: targetData, error: targetError } = await supabase
    .from("stories" as any)
    .select(storiesSelectWithBlur)
    .eq("id", targetId)
    .gt("expiry_time", new Date().toISOString())
    .maybeSingle();

  if (targetError && isMissingMediaBlurhashesError(targetError.message)) {
    const retry = await supabase
      .from("stories" as any)
      .select(storiesSelectLegacy)
      .eq("id", targetId)
      .gt("expiry_time", new Date().toISOString())
      .maybeSingle();
    targetData = retry.data;
    targetError = retry.error;
  }

  if (targetError) throw targetError;
  const targetRow = targetData as unknown as StoryRow | null;
  if (!targetRow) return null;

  let { data: userStoriesData, error: userStoriesError } = await supabase
    .from("stories" as any)
    .select(storiesSelectWithBlur)
    .eq("user_id", targetRow.user_id)
    .gt("expiry_time", new Date().toISOString())
    .order("created_at", { ascending: true });

  if (userStoriesError && isMissingMediaBlurhashesError(userStoriesError.message)) {
    const retry = await supabase
      .from("stories" as any)
      .select(storiesSelectLegacy)
      .eq("user_id", targetRow.user_id)
      .gt("expiry_time", new Date().toISOString())
      .order("created_at", { ascending: true });
    userStoriesData = retry.data;
    userStoriesError = retry.error;
  }

  if (userStoriesError) throw userStoriesError;

  const userStories = (userStoriesData ?? []) as unknown as StoryRow[];
  const rows = userStories.some((row) => row.id === targetId) ? userStories : [targetRow, ...userStories];
  const items = await enrichStories(rows, viewerUserId);
  const groups = groupStories(items);

  const groupIndex = groups.findIndex((group) => group.user_id === targetRow.user_id);
  if (groupIndex < 0) return null;

  const storyIndex = groups[groupIndex]?.stories.findIndex((story) => story.id === targetId) ?? -1;
  if (storyIndex < 0) return null;

  const placeId = targetRow.place_id?.trim() || "";

  return {
    groups,
    initialGroupIndex: groupIndex,
    initialStoryIndex: storyIndex,
    placeId,
  };
}
