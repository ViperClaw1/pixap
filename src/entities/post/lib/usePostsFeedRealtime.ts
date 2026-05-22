import { useCallback } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useRealtimeChannel } from "@/shared/realtime/useRealtimeChannel";
import { realtimeEventBus } from "@/shared/realtime/eventBus";
import type { PostRow } from "@/shared/realtime/events";
import { schedulePostsFeedInvalidate } from "./postFeedCachePatch";

function invalidatePostComments(queryClient: QueryClient, postId: string | undefined) {
  if (postId) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.posts.comments(postId) });
  }
}

function parsePostRow(payload: { new: Record<string, unknown>; old: Record<string, unknown> }): PostRow | null {
  const row = (payload.new?.id ? payload.new : payload.old) as Record<string, unknown>;
  if (!row?.id) return null;
  return {
    id: String(row.id),
    user_id: String(row.user_id ?? ""),
    place_id: (row.place_id as string | null) ?? null,
    content: String(row.content ?? ""),
    media_url: (row.media_url as string | null) ?? null,
    created_at: String(row.created_at ?? ""),
  };
}

/** Posts feed: new posts, likes, comments (debounced invalidation). */
export function usePostsFeedRealtime(userId: string | null | undefined) {
  const queryClient = useQueryClient();

  const createChannel = useCallback(() => {
    const onPostCommentsChange = (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => {
      const row = (payload.new?.post_id ? payload.new : payload.old) as { post_id?: string };
      const postId = typeof row.post_id === "string" ? row.post_id : undefined;
      invalidatePostComments(queryClient, postId);
      schedulePostsFeedInvalidate(queryClient);
      realtimeEventBus.emit({ type: "engagement.updated", postId });
    };

    return supabase
      .channel(`posts_feed_${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, (payload) => {
        const post = parsePostRow(payload as { new: Record<string, unknown>; old: Record<string, unknown> });
        if (post) realtimeEventBus.emit({ type: "post.created", post });
        schedulePostsFeedInvalidate(queryClient, "posts_insert");
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "posts" }, (payload) => {
        const post = parsePostRow(payload as { new: Record<string, unknown>; old: Record<string, unknown> });
        if (post) realtimeEventBus.emit({ type: "post.updated", post });
        schedulePostsFeedInvalidate(queryClient);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "posts" }, (payload) => {
        const post = parsePostRow(payload as { new: Record<string, unknown>; old: Record<string, unknown> });
        if (post?.id) realtimeEventBus.emit({ type: "post.deleted", postId: post.id });
        schedulePostsFeedInvalidate(queryClient);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "post_reactions" }, () => {
        schedulePostsFeedInvalidate(queryClient, "post_reactions");
        realtimeEventBus.emit({ type: "engagement.updated" });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments" }, onPostCommentsChange);
  }, [userId, queryClient]);

  return useRealtimeChannel(userId ? `posts_feed_${userId}` : null, userId ? createChannel : null, {
    scope: "posts_feed",
  });
}
