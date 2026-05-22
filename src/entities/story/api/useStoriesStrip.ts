import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import type { StoryProfile } from "@/shared/model/types/stories";
import { parseMediaBlurhashesColumn } from "@/shared/lib/parseMediaBlurhashesColumn";
import { useStoriesFeedRealtime } from "@/entities/story/lib/useStoriesFeedRealtime";
import { REALTIME_POLL_MS } from "@/shared/realtime/realtimePolling";
import { useAuth } from "@/app/providers/AuthProvider";

type StoryStripItem = {
  id: string;
  user_id: string;
  created_at: string;
  media_url: string | null;
  media_blurhashes?: (string | null)[] | null;
  profile: StoryProfile | null;
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

export const useStoriesStrip = () => {
  const { user } = useAuth();
  const realtimeConnected = useStoriesFeedRealtime(user?.id ?? null);

  return useQuery({
    queryKey: queryKeys.stories.strip,
    refetchInterval: realtimeConnected ? false : REALTIME_POLL_MS.storiesFeed,
    queryFn: async () => {
      const storiesSelectWithBlur = "id, user_id, created_at, media_url, media_blurhashes";
      const storiesSelectLegacy = "id, user_id, created_at, media_url";

      let { data: storiesData, error: storiesError } = await supabase
        .from("stories" as any)
        .select(storiesSelectWithBlur)
        .gt("expiry_time", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(100);
      if (storiesError && isMissingMediaBlurhashesError(storiesError.message)) {
        const retry = await supabase
          .from("stories" as any)
          .select(storiesSelectLegacy)
          .gt("expiry_time", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(100);
        storiesData = retry.data;
        storiesError = retry.error;
      }
      if (storiesError) throw storiesError;

      const stories = (storiesData ?? []) as unknown as Array<{
        id: string;
        user_id: string;
        created_at: string;
        media_url: string | null;
        media_blurhashes?: unknown;
      }>;
      if (!stories.length) return [] as StoryStripItem[];

      const userIds = Array.from(new Set(stories.map((story) => story.user_id)));
      const { data: profilesData, error: profilesError } = await supabase
        .from("public_profiles" as any)
        .select("id, first_name, last_name, avatar_url, username")
        .in("id", userIds);
      if (profilesError) throw profilesError;

      const profilesById = new Map<string, StoryProfile>(
        ((profilesData ?? []) as unknown as ProfileRow[]).map((profile) => [
          profile.id,
          {
            id: profile.id,
            first_name: profile.first_name,
            last_name: profile.last_name,
            avatar_url: profile.avatar_url,
            username: profile.username,
          },
        ]),
      );

      return stories.map((story) => ({
        ...story,
        media_blurhashes: parseMediaBlurhashesColumn(story.media_blurhashes),
        profile: profilesById.get(story.user_id) ?? null,
      }));
    },
    staleTime: 45 * 1000,
  });
};
