import { useCallback, useMemo } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useRealtimeChannel } from "@/shared/realtime/useRealtimeChannel";
import { realtimeEventBus } from "@/shared/realtime/eventBus";
import type { PostRow } from "@/shared/realtime/events";
import {
  buildAuthorUserIdInFilter,
  isRelevantFeedAuthor,
} from "@/shared/realtime/realtimeAuthorFilter";
import { useMyFollowing } from "@/entities/user";
import {
  feedCachesContainPost,
  patchPostReactionInFeedCaches,
  removePostFromAllFeedCaches,
  schedulePostsFeedInvalidate,
} from "./postFeedCachePatch";
import { parsePostReactionRow } from "./parsePostRealtimePayload";

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

function handlePostReactionChange(
  queryClient: QueryClient,
  viewerUserId: string,
  eventType: string,
  payload: { new: Record<string, unknown>; old: Record<string, unknown> },
) {
  const row = parsePostReactionRow(payload as Parameters<typeof parsePostReactionRow>[0]);
  if (!row?.post_id || row.type !== "like") return;
  // Own likes are optimistically patched in useReactToPost; applying realtime again doubles the count.
  if (row.user_id === viewerUserId) return;
  if (!feedCachesContainPost(queryClient, row.post_id)) return;

  if (eventType === "INSERT") {
    patchPostReactionInFeedCaches(queryClient, row.post_id, {
      reactionCountDelta: 1,
      viewerUserId,
      reactionUserId: row.user_id,
      reactionType: "like",
    });
    realtimeEventBus.emit({ type: "engagement.updated", postId: row.post_id });
    return;
  }

  if (eventType === "DELETE") {
    patchPostReactionInFeedCaches(queryClient, row.post_id, {
      reactionCountDelta: -1,
      viewerUserId,
      reactionUserId: row.user_id,
      reactionType: "like",
      removed: true,
    });
    realtimeEventBus.emit({ type: "engagement.updated", postId: row.post_id });
    return;
  }

  if (eventType === "UPDATE") {
    schedulePostsFeedInvalidate(queryClient, "post_reactions_update");
    realtimeEventBus.emit({ type: "engagement.updated", postId: row.post_id });
  }
}

/** Posts feed: new posts, likes, comments (debounced invalidation). */
export function usePostsFeedRealtime(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  const { followingIds, followingSet } = useMyFollowing();
  const followingSignature = useMemo(() => [...followingIds].sort().join(","), [followingIds]);

  const createChannel = useCallback(() => {
    const authorFilter = buildAuthorUserIdInFilter(userId!, followingIds);
    const postsTableConfig = {
      schema: "public" as const,
      table: "posts" as const,
      ...(authorFilter ? { filter: authorFilter } : {}),
    };

    const onPostCommentsChange = (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => {
      const row = (payload.new?.post_id ? payload.new : payload.old) as { post_id?: string };
      const postId = typeof row.post_id === "string" ? row.post_id : undefined;
      invalidatePostComments(queryClient, postId);
      if (postId && feedCachesContainPost(queryClient, postId)) {
        schedulePostsFeedInvalidate(queryClient);
        realtimeEventBus.emit({ type: "engagement.updated", postId });
      }
    };

    return supabase
      .channel(`posts_feed_${userId}_${followingSignature}`)
      .on("postgres_changes", { event: "INSERT", ...postsTableConfig }, (payload) => {
        const post = parsePostRow(payload as { new: Record<string, unknown>; old: Record<string, unknown> });
        if (!post) return;
        if (!isRelevantFeedAuthor(post.user_id, userId, followingSet)) return;
        realtimeEventBus.emit({ type: "post.created", post });
        schedulePostsFeedInvalidate(queryClient, "posts_insert");
      })
      .on("postgres_changes", { event: "UPDATE", ...postsTableConfig }, (payload) => {
        const post = parsePostRow(payload as { new: Record<string, unknown>; old: Record<string, unknown> });
        if (!post) return;
        if (!feedCachesContainPost(queryClient, post.id) && !isRelevantFeedAuthor(post.user_id, userId, followingSet)) {
          return;
        }
        realtimeEventBus.emit({ type: "post.updated", post });
        schedulePostsFeedInvalidate(queryClient);
      })
      .on("postgres_changes", { event: "DELETE", ...postsTableConfig }, (payload) => {
        const post = parsePostRow(payload as { new: Record<string, unknown>; old: Record<string, unknown> });
        if (!post?.id) return;
        if (feedCachesContainPost(queryClient, post.id)) {
          removePostFromAllFeedCaches(queryClient, post.id);
        }
        realtimeEventBus.emit({ type: "post.deleted", postId: post.id });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "post_reactions" }, (payload) => {
        handlePostReactionChange(
          queryClient,
          userId,
          payload.eventType,
          payload as { new: Record<string, unknown>; old: Record<string, unknown> },
        );
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments" }, onPostCommentsChange);
  }, [userId, followingIds, followingSet, followingSignature, queryClient]);

  const channelKey = userId ? `posts_feed_${userId}_${followingSignature}` : null;

  return useRealtimeChannel(channelKey, userId ? createChannel : null, {
    scope: "posts_feed",
  });
}
