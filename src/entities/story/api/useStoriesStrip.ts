import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import type { StoryProfile } from "@/types/stories";

type StoryStripItem = {
  id: string;
  user_id: string;
  created_at: string;
  media_url: string | null;
  profile: StoryProfile | null;
};

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

export const useStoriesStrip = () => {
  return useQuery({
    queryKey: ["stories", "strip"],
    queryFn: async () => {
      const { data: storiesData, error: storiesError } = await supabase
        .from("stories" as any)
        .select("id, user_id, created_at, media_url")
        .gt("expiry_time", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(100);
      if (storiesError) throw storiesError;

      const stories = (storiesData ?? []) as Array<{ id: string; user_id: string; created_at: string; media_url: string | null }>;
      if (!stories.length) return [] as StoryStripItem[];

      const userIds = Array.from(new Set(stories.map((story) => story.user_id)));
      const { data: profilesData, error: profilesError } = await supabase
        .from("public_profiles" as any)
        .select("id, first_name, last_name, avatar_url")
        .in("id", userIds);
      if (profilesError) throw profilesError;

      const profilesById = new Map<string, StoryProfile>(
        ((profilesData ?? []) as ProfileRow[]).map((profile) => [
          profile.id,
          {
            id: profile.id,
            first_name: profile.first_name,
            last_name: profile.last_name,
            avatar_url: profile.avatar_url,
          },
        ]),
      );

      return stories.map((story) => ({
        ...story,
        profile: profilesById.get(story.user_id) ?? null,
      }));
    },
  });
};
