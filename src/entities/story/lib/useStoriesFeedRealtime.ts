import { useEffect, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { RealtimeConnectionManager } from "@/shared/realtime/connectionManager";
import { clearStoriesFeedInteractedPlaceCache } from "./storiesFeedInteractedPlaceCache";

function invalidateStoriesFeed(queryClient: QueryClient, userId: string) {
  clearStoriesFeedInteractedPlaceCache(userId);
  void queryClient.invalidateQueries({ queryKey: queryKeys.stories.feedPrefix });
  void queryClient.invalidateQueries({ queryKey: queryKeys.stories.strip });
}

function invalidateStoryComments(queryClient: QueryClient, storyId: string | undefined) {
  if (storyId) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.stories.comments(storyId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.stories.commentsStoryPrefix });
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
  const onStoryCommentsChange = (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => {
    const row = (payload.new?.story_id ? payload.new : payload.old) as { story_id?: string };
    invalidateStoryComments(queryClient, typeof row.story_id === "string" ? row.story_id : undefined);
    invalidateStoriesFeed(queryClient, userId);
  };

  return supabase
    .channel(`stories_feed_${userId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "stories" }, () => {
      invalidateStoriesFeed(queryClient, userId);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "story_reactions" }, () => {
      invalidateStoriesFeed(queryClient, userId);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "story_comments" }, onStoryCommentsChange);
}

/** Stories feed + strip: ref-counted channel per user via RealtimeConnectionManager. */
export function useStoriesFeedRealtime(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  const [realtimeConnected, setRealtimeConnected] = useState(true);

  useEffect(() => {
    if (!userId) {
      setRealtimeConnected(true);
      return;
    }

    const key = `stories_feed_${userId}`;
    let shared = sharedByUser.get(userId);

    if (!shared) {
      const manager = RealtimeConnectionManager.get();
      const entry: SharedSubscription = {
        refCount: 0,
        connected: true,
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
