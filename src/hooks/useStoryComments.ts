import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StoryComment {
  id: string;
  story_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
}

export const useStoryComments = (storyId: string) => {
  const queryClient = useQueryClient();
  const [realtimeConnected, setRealtimeConnected] = useState(true);

  useEffect(() => {
    if (!storyId) return;
    const channel = supabase
      .channel(`story_comments_${storyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "story_comments", filter: `story_id=eq.${storyId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["story_comments", "story", storyId] });
        },
      )
      .subscribe((status) => setRealtimeConnected(status === "SUBSCRIBED"));

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, storyId]);

  return useQuery({
    queryKey: ["story_comments", "story", storyId],
    queryFn: async () => {
      const { data, error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table types are not yet regenerated
        .from("story_comments" as any)
        .select("id, story_id, user_id, parent_id, content, created_at")
        .eq("story_id", storyId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as StoryComment[];
    },
    enabled: !!storyId,
    refetchInterval: realtimeConnected ? false : 15000,
  });
};
