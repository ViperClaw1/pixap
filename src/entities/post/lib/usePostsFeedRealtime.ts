import { useEffect, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";

function invalidatePostsFeed(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.posts.feedPrefix });
}

function invalidatePostComments(queryClient: QueryClient, postId: string | undefined) {
  if (postId) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.posts.comments(postId) });
  }
}

/** Posts feed: new posts, likes, comments. */
export function usePostsFeedRealtime(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  const [realtimeConnected, setRealtimeConnected] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const onPostCommentsChange = (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => {
      const row = (payload.new?.post_id ? payload.new : payload.old) as { post_id?: string };
      invalidatePostComments(queryClient, typeof row.post_id === "string" ? row.post_id : undefined);
      invalidatePostsFeed(queryClient);
    };

    const channel = supabase
      .channel(`posts_feed_${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => {
        invalidatePostsFeed(queryClient);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "post_reactions" }, () => {
        invalidatePostsFeed(queryClient);
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_comments" },
        onPostCommentsChange,
      )
      .subscribe((status) => setRealtimeConnected(status === "SUBSCRIBED"));

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return realtimeConnected;
}
