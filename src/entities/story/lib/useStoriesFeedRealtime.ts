import { useEffect, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
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

type RealtimeSubscription = {
  refCount: number;
  realtimeConnected: boolean;
  listeners: Set<(connected: boolean) => void>;
  cleanup: () => void;
};

const subscriptions = new Map<string, RealtimeSubscription>();

function setSubscriptionConnected(sub: RealtimeSubscription, connected: boolean) {
  sub.realtimeConnected = connected;
  for (const listener of sub.listeners) {
    listener(connected);
  }
}

/** Stories feed + strip: new stories, likes, comments (ref-counted channel per user). */
export function useStoriesFeedRealtime(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  const [realtimeConnected, setRealtimeConnected] = useState(true);

  useEffect(() => {
    if (!userId) {
      setRealtimeConnected(true);
      return;
    }

    let sub = subscriptions.get(userId);
    if (!sub) {
      const onStoryCommentsChange = (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => {
        const row = (payload.new?.story_id ? payload.new : payload.old) as { story_id?: string };
        invalidateStoryComments(queryClient, typeof row.story_id === "string" ? row.story_id : undefined);
        invalidateStoriesFeed(queryClient, userId);
      };

      const channel = supabase
        .channel(`stories_feed_${userId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "stories" }, () => {
          invalidateStoriesFeed(queryClient, userId);
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "story_reactions" }, () => {
          invalidateStoriesFeed(queryClient, userId);
        })
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "story_comments" },
          onStoryCommentsChange,
        )
        .subscribe((status) => {
          const connected = subscriptions.get(userId);
          if (connected) setSubscriptionConnected(connected, status === "SUBSCRIBED");
        });

      sub = {
        refCount: 0,
        realtimeConnected: true,
        listeners: new Set(),
        cleanup: () => {
          void supabase.removeChannel(channel);
        },
      };
      subscriptions.set(userId, sub);
    }

    sub.refCount += 1;
    const listener = (connected: boolean) => setRealtimeConnected(connected);
    sub.listeners.add(listener);
    setRealtimeConnected(sub.realtimeConnected);

    return () => {
      const current = subscriptions.get(userId);
      if (!current) return;
      current.listeners.delete(listener);
      current.refCount -= 1;
      if (current.refCount <= 0) {
        current.cleanup();
        subscriptions.delete(userId);
      }
    };
  }, [userId, queryClient]);

  return realtimeConnected;
}
