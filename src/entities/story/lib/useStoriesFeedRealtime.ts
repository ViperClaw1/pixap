import { useEffect, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { RealtimeConnectionManager } from "@/shared/realtime/connectionManager";
import {
  feedCachesContainStory,
  patchStoryCommentInFeedCaches,
  patchStoryInAllFeedCaches,
  patchStoryReactionInFeedCaches,
  removeStoryFromFeedCaches,
  removeStoryFromStripCache,
  scheduleStoriesFeedInvalidate,
} from "./storyFeedCachePatch";
import {
  parseStoryCommentRow,
  parseStoryReactionRow,
  parseStoryRow,
} from "./parseStoryRealtimePayload";

function invalidateStoryComments(queryClient: QueryClient, storyId: string | undefined) {
  if (storyId) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.stories.comments(storyId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.stories.commentsStoryPrefix });
  }
}

function handleStoryTableChange(
  queryClient: QueryClient,
  eventType: string,
  payload: { new: Record<string, unknown>; old: Record<string, unknown> },
) {
  const row = parseStoryRow(payload as Parameters<typeof parseStoryRow>[0]);
  if (!row) return;

  if (eventType === "DELETE") {
    removeStoryFromFeedCaches(queryClient, row.id);
    removeStoryFromStripCache(queryClient, row.id);
    return;
  }

  if (eventType === "INSERT") {
    scheduleStoriesFeedInvalidate(queryClient, "stories_insert");
    return;
  }

  if (eventType === "UPDATE") {
    const patched = patchStoryInAllFeedCaches(queryClient, row.id, (story) => ({
      ...story,
      content: row.content || story.content,
      media_url: row.media_url ?? story.media_url,
      created_at: row.created_at || story.created_at,
    }));
    if (!patched) scheduleStoriesFeedInvalidate(queryClient, "stories_update");
  }
}

function handleStoryReactionChange(
  queryClient: QueryClient,
  userId: string,
  eventType: string,
  payload: { new: Record<string, unknown>; old: Record<string, unknown> },
) {
  const row = parseStoryReactionRow(payload as Parameters<typeof parseStoryReactionRow>[0]);
  if (!row?.story_id || row.type !== "like") return;
  if (!feedCachesContainStory(queryClient, row.story_id)) return;

  if (eventType === "INSERT") {
    patchStoryReactionInFeedCaches(queryClient, row.story_id, {
      reactionCountDelta: 1,
      viewerUserId: userId,
      reactionUserId: row.user_id,
      reactionType: "like",
    });
    return;
  }

  if (eventType === "DELETE") {
    patchStoryReactionInFeedCaches(queryClient, row.story_id, {
      reactionCountDelta: -1,
      viewerUserId: userId,
      reactionUserId: row.user_id,
      reactionType: "like",
      removed: true,
    });
    return;
  }

  if (eventType === "UPDATE") {
    scheduleStoriesFeedInvalidate(queryClient, "story_reactions_update");
  }
}

function handleStoryCommentChange(
  queryClient: QueryClient,
  eventType: string,
  payload: { new: Record<string, unknown>; old: Record<string, unknown> },
) {
  const row = parseStoryCommentRow(payload as Parameters<typeof parseStoryCommentRow>[0]);
  if (!row?.story_id) return;

  invalidateStoryComments(queryClient, row.story_id);

  if (row.parent_id) return;

  if (!feedCachesContainStory(queryClient, row.story_id)) return;

  if (eventType === "INSERT") {
    patchStoryCommentInFeedCaches(queryClient, row.story_id, {
      commentCountDelta: 1,
      newComment: { id: row.id, content: row.content, created_at: row.created_at },
    });
    return;
  }

  if (eventType === "DELETE") {
    patchStoryCommentInFeedCaches(queryClient, row.story_id, {
      commentCountDelta: -1,
      removedCommentId: row.id,
    });
    return;
  }

  if (eventType === "UPDATE") {
    patchStoryCommentInFeedCaches(queryClient, row.story_id, {
      commentCountDelta: 0,
      newComment: { id: row.id, content: row.content, created_at: row.created_at },
    });
  }
}

type Listener = (connected: boolean) => void;

type SharedSubscription = {
  refCount: number;
  connected: boolean;
  listeners: Set<Listener>;
  release: () => void;
};

const sharedByUser = new Map<string, SharedSubscription>();

function setSharedConnected(sub: SharedSubscription, connected: boolean) {
  sub.connected = connected;
  for (const listener of sub.listeners) {
    listener(connected);
  }
}

function buildStoriesFeedChannel(queryClient: QueryClient, userId: string) {
  return supabase
    .channel(`stories_feed_${userId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "stories" }, (payload) => {
      handleStoryTableChange(
        queryClient,
        payload.eventType,
        payload as { new: Record<string, unknown>; old: Record<string, unknown> },
      );
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "story_reactions" }, (payload) => {
      handleStoryReactionChange(
        queryClient,
        userId,
        payload.eventType,
        payload as { new: Record<string, unknown>; old: Record<string, unknown> },
      );
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "story_comments" }, (payload) => {
      handleStoryCommentChange(
        queryClient,
        payload.eventType,
        payload as { new: Record<string, unknown>; old: Record<string, unknown> },
      );
    });
}

/** Stories feed + strip: ref-counted channel per user via RealtimeConnectionManager. */
export function useStoriesFeedRealtime(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  useEffect(() => {
    if (!userId) {
      setRealtimeConnected(false);
      return;
    }

    const key = `stories_feed_${userId}`;
    let shared = sharedByUser.get(userId);

    if (!shared) {
      const manager = RealtimeConnectionManager.get();
      const entry: SharedSubscription = {
        refCount: 0,
        connected: false,
        listeners: new Set(),
        release: () => {},
      };
      entry.release = manager.acquire(
        key,
        () => buildStoriesFeedChannel(queryClient, userId),
        (status) => setSharedConnected(entry, status === "subscribed"),
        "stories_feed",
      );
      shared = entry;
      sharedByUser.set(userId, shared);
    }

    shared.refCount += 1;
    const listener: Listener = (connected) => setRealtimeConnected(connected);
    shared.listeners.add(listener);
    setRealtimeConnected(shared.connected);

    return () => {
      const current = sharedByUser.get(userId);
      if (!current) return;
      current.listeners.delete(listener);
      current.refCount -= 1;
      if (current.refCount <= 0) {
        current.release();
        sharedByUser.delete(userId);
      }
    };
  }, [userId, queryClient]);

  return realtimeConnected;
}
