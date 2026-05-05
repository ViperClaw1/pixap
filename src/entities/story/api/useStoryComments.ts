import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import type { StoryProfile } from "@/types/stories";

export interface StoryComment {
  id: string;
  story_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  profile: StoryProfile | null;
  replies: StoryReply[];
}

export interface StoryReply {
  id: string;
  comment_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile: StoryProfile | null;
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

    const repliesChannel = supabase
      .channel(`story_replies_${storyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "story_replies" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["story_comments", "story", storyId] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
      void supabase.removeChannel(repliesChannel);
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
        .is("parent_id", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const comments = ((data ?? []) as unknown as Array<Omit<StoryComment, "replies" | "profile">>) ?? [];
      if (!comments.length) return [] as StoryComment[];

      const commentIds = comments.map((comment) => comment.id);
      const { data: repliesData, error: repliesError } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table types are not yet regenerated
        .from("story_replies" as any)
        .select("id, comment_id, user_id, content, created_at")
        .in("comment_id", commentIds)
        .order("created_at", { ascending: true });
      const repliesMaybeMissingTable = repliesError && "code" in repliesError && repliesError.code === "42P01";
      if (repliesError && !repliesMaybeMissingTable) throw repliesError;

      const repliesSafe = repliesMaybeMissingTable ? [] : (((repliesData ?? []) as unknown as StoryReply[]) ?? []);

      const allUserIds = Array.from(
        new Set([...comments.map((comment) => comment.user_id), ...repliesSafe.map((reply) => reply.user_id)]),
      );
      const { data: profilesData, error: profilesError } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table types are not yet regenerated
        .from("public_profiles" as any)
        .select("id, first_name, last_name, avatar_url")
        .in("id", allUserIds);
      if (profilesError) throw profilesError;

      const profilesById = new Map<string, StoryProfile>(
        (((profilesData ?? []) as unknown as StoryProfile[]) ?? []).map((profile) => [profile.id, profile]),
      );

      const repliesByCommentId = new Map<string, StoryReply[]>();
      for (const reply of repliesSafe) {
        if (!repliesByCommentId.has(reply.comment_id)) repliesByCommentId.set(reply.comment_id, []);
        repliesByCommentId.get(reply.comment_id)!.push({
          ...reply,
          profile: profilesById.get(reply.user_id) ?? null,
        });
      }

      return comments.map((comment) => ({
        ...comment,
        profile: profilesById.get(comment.user_id) ?? null,
        replies: repliesByCommentId.get(comment.id) ?? [],
      }));
    },
    enabled: !!storyId,
    refetchInterval: realtimeConnected ? false : 15000,
  });
};
