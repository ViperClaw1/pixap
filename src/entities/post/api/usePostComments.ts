import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/app/providers/AuthProvider";
import type { PostProfile } from "@/shared/model/types/posts";
import { REALTIME_POLL_MS } from "@/shared/realtime/realtimePolling";

export interface PostReply {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string;
  content: string;
  created_at: string;
  profile: PostProfile | null;
  like_count: number;
  liked_by_me: boolean;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: null;
  content: string;
  created_at: string;
  profile: PostProfile | null;
  replies: PostReply[];
  like_count: number;
  liked_by_me: boolean;
}

function aggregateCommentLikes(
  rows: { comment_id: string | null; user_id: string }[],
  userId: string | undefined,
  commentIds: string[],
) {
  const likes = new Map<string, { count: number; me: boolean }>();
  for (const id of commentIds) likes.set(id, { count: 0, me: false });
  for (const row of rows) {
    if (!row.comment_id) continue;
    const slot = likes.get(row.comment_id);
    if (!slot) continue;
    slot.count += 1;
    if (userId && row.user_id === userId) slot.me = true;
  }
  return likes;
}

const EMPTY_POST_COMMENTS: PostComment[] = [];

function selectStablePostComments(data: PostComment[]) {
  return data.length === 0 ? EMPTY_POST_COMMENTS : data;
}

export const usePostComments = (postId: string) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  useEffect(() => {
    if (!postId) return;
    const channel = supabase
      .channel(`post_comments_${postId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments", filter: `post_id=eq.${postId}` }, () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.posts.comments(postId) });
      })
      .subscribe((status) => setRealtimeConnected(status === "SUBSCRIBED"));

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [postId, queryClient]);

  return useQuery({
    queryKey: queryKeys.posts.comments(postId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_comments" as any)
        .select("id, post_id, user_id, parent_id, content, created_at")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const allComments = (data ?? []) as Array<{
        id: string;
        post_id: string;
        user_id: string;
        parent_id: string | null;
        content: string;
        created_at: string;
      }>;

      const profileIds = Array.from(new Set(allComments.map((item) => item.user_id)));
      const { data: profilesData, error: profilesError } = await supabase
        .from("public_profiles" as any)
        .select("id, first_name, last_name, avatar_url, username")
        .in("id", profileIds);
      if (profilesError) throw profilesError;

      const profiles = new Map<string, PostProfile>(
        ((profilesData ?? []) as PostProfile[]).map((profile) => [profile.id, profile]),
      );

      const comments = allComments.filter((item) => !item.parent_id);
      const replies = allComments.filter((item): item is Omit<PostReply, "profile" | "like_count" | "liked_by_me"> => !!item.parent_id);
      const allCommentIds = allComments.map((item) => item.id);
      let commentLikes = aggregateCommentLikes([], user?.id, allCommentIds);

      if (allCommentIds.length) {
        const { data: reactionRows, error: reactionsError } = await supabase
          .from("post_reactions" as any)
          .select("comment_id, user_id, type")
          .eq("type", "like")
          .not("comment_id", "is", null)
          .in("comment_id", allCommentIds);
        if (reactionsError) throw reactionsError;
        commentLikes = aggregateCommentLikes(
          (reactionRows ?? []) as { comment_id: string | null; user_id: string }[],
          user?.id,
          allCommentIds,
        );
      }

      const repliesByCommentId = new Map<string, PostReply[]>();
      for (const reply of replies) {
        const rl = commentLikes.get(reply.id) ?? { count: 0, me: false };
        if (!repliesByCommentId.has(reply.parent_id)) repliesByCommentId.set(reply.parent_id, []);
        repliesByCommentId.get(reply.parent_id)!.push({
          ...reply,
          profile: profiles.get(reply.user_id) ?? null,
          like_count: rl.count,
          liked_by_me: rl.me,
        });
      }

      return comments.map((comment) => {
        const cl = commentLikes.get(comment.id) ?? { count: 0, me: false };
        return {
          ...comment,
          parent_id: null,
          profile: profiles.get(comment.user_id) ?? null,
          replies: repliesByCommentId.get(comment.id) ?? [],
          like_count: cl.count,
          liked_by_me: cl.me,
        };
      }) as PostComment[];
    },
    enabled: !!postId,
    refetchInterval: realtimeConnected ? false : REALTIME_POLL_MS.postComments,
    select: selectStablePostComments,
  });
};
