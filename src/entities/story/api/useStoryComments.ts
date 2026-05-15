import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/app/providers/AuthProvider";
import type { StoryProfile } from "@/shared/model/types/stories";

export interface StoryComment {
  id: string;
  story_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  profile: StoryProfile | null;
  replies: StoryReply[];
  like_count: number;
  liked_by_me: boolean;
}

export interface StoryReply {
  id: string;
  comment_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile: StoryProfile | null;
  like_count: number;
  liked_by_me: boolean;
}

type CommentDbRow = {
  id: string;
  story_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
};

type ReplyDbRow = {
  id: string;
  comment_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

function aggregateLikes(
  rows: { comment_id: string | null; reply_id: string | null; user_id: string }[],
  userId: string | undefined,
  commentIds: string[],
  replyIds: string[],
) {
  const commentLikes = new Map<string, { count: number; me: boolean }>();
  const replyLikes = new Map<string, { count: number; me: boolean }>();
  for (const id of commentIds) commentLikes.set(id, { count: 0, me: false });
  for (const id of replyIds) replyLikes.set(id, { count: 0, me: false });

  for (const row of rows) {
    if (row.comment_id) {
      const slot = commentLikes.get(row.comment_id);
      if (slot) {
        slot.count += 1;
        if (userId && row.user_id === userId) slot.me = true;
      }
    }
    if (row.reply_id) {
      const slot = replyLikes.get(row.reply_id);
      if (slot) {
        slot.count += 1;
        if (userId && row.user_id === userId) slot.me = true;
      }
    }
  }

  return { commentLikes, replyLikes };
}

export const useStoryComments = (storyId: string) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [realtimeConnected, setRealtimeConnected] = useState(true);

  useEffect(() => {
    if (!storyId) return;
    const channel = supabase
      .channel(`story_comments_${storyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "story_comments", filter: `story_id=eq.${storyId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.stories.comments(storyId) });
        },
      )
      .subscribe((status) => setRealtimeConnected(status === "SUBSCRIBED"));

    const repliesChannel = supabase
      .channel(`story_replies_${storyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "story_replies" }, () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.stories.comments(storyId) });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
      void supabase.removeChannel(repliesChannel);
    };
  }, [queryClient, storyId]);

  return useQuery({
    queryKey: queryKeys.stories.commentsQuery(storyId, user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table types are not yet regenerated
        .from("story_comments" as any)
        .select("id, story_id, user_id, parent_id, content, created_at")
        .eq("story_id", storyId)
        .is("parent_id", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const comments = ((data ?? []) as unknown as CommentDbRow[]) ?? [];
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

      const repliesSafe = repliesMaybeMissingTable ? [] : (((repliesData ?? []) as unknown as ReplyDbRow[]) ?? []);
      const replyIds = repliesSafe.map((r) => r.id);

      const allUserIds = Array.from(
        new Set([...comments.map((comment) => comment.user_id), ...repliesSafe.map((reply) => reply.user_id)]),
      );
      const { data: profilesData, error: profilesError } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table types are not yet regenerated
        .from("public_profiles" as any)
        .select("id, first_name, last_name, avatar_url, username")
        .in("id", allUserIds);
      if (profilesError) throw profilesError;

      const profilesById = new Map<string, StoryProfile>(
        (((profilesData ?? []) as unknown as StoryProfile[]) ?? []).map((profile) => [profile.id, profile]),
      );

      let commentLikes = new Map<string, { count: number; me: boolean }>();
      let replyLikes = new Map<string, { count: number; me: boolean }>();
      for (const id of commentIds) commentLikes.set(id, { count: 0, me: false });
      for (const id of replyIds) replyLikes.set(id, { count: 0, me: false });

      if (commentIds.length) {
        const { data: rc, error: rcErr } = await supabase
          .from("story_reactions" as any)
          .select("comment_id, reply_id, user_id, type")
          .eq("type", "like")
          .not("comment_id", "is", null)
          .in("comment_id", commentIds);
        if (!rcErr && rc) {
          const agg = aggregateLikes(
            rc as unknown as { comment_id: string | null; reply_id: string | null; user_id: string }[],
            user?.id,
            commentIds,
            replyIds,
          );
          commentLikes = agg.commentLikes;
        }
      }

      if (replyIds.length) {
        const { data: rr, error: rrErr } = await supabase
          .from("story_reactions" as any)
          .select("comment_id, reply_id, user_id, type")
          .eq("type", "like")
          .not("reply_id", "is", null)
          .in("reply_id", replyIds);
        const missingColumn = rrErr && "code" in rrErr && (rrErr as { code?: string }).code === "42703";
        if (!rrErr && rr) {
          const agg = aggregateLikes(
            rr as unknown as { comment_id: string | null; reply_id: string | null; user_id: string }[],
            user?.id,
            commentIds,
            replyIds,
          );
          for (const [id, v] of agg.replyLikes) replyLikes.set(id, v);
        } else if (!missingColumn && rrErr) throw rrErr;
      }

      const repliesByCommentId = new Map<string, StoryReply[]>();
      for (const reply of repliesSafe) {
        const prof = profilesById.get(reply.user_id) ?? null;
        const rl = replyLikes.get(reply.id) ?? { count: 0, me: false };
        const hydrated: StoryReply = {
          ...reply,
          profile: prof,
          like_count: rl.count,
          liked_by_me: rl.me,
        };
        if (!repliesByCommentId.has(reply.comment_id)) repliesByCommentId.set(reply.comment_id, []);
        repliesByCommentId.get(reply.comment_id)!.push(hydrated);
      }

      return comments.map((comment) => {
        const cl = commentLikes.get(comment.id) ?? { count: 0, me: false };
        return {
          ...comment,
          profile: profilesById.get(comment.user_id) ?? null,
          replies: repliesByCommentId.get(comment.id) ?? [],
          like_count: cl.count,
          liked_by_me: cl.me,
        };
      });
    },
    enabled: !!storyId,
    refetchInterval: realtimeConnected ? false : 15000,
  });
};
