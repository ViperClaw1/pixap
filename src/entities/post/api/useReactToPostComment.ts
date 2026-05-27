import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/app/providers/AuthProvider";
import type { PostComment } from "./usePostComments";

function patchCommentsLike(comments: PostComment[], commentId: string): PostComment[] {
  return comments.map((c) => {
    if (c.id === commentId) {
      return {
        ...c,
        liked_by_me: !c.liked_by_me,
        like_count: Math.max(0, c.like_count + (c.liked_by_me ? -1 : 1)),
      };
    }
    const replyIndex = c.replies.findIndex((r) => r.id === commentId);
    if (replyIndex < 0) return c;
    const reply = c.replies[replyIndex];
    const nextReply = {
      ...reply,
      liked_by_me: !reply.liked_by_me,
      like_count: Math.max(0, reply.like_count + (reply.liked_by_me ? -1 : 1)),
    };
    const replies = [...c.replies];
    replies[replyIndex] = nextReply;
    return { ...c, replies };
  });
}

interface ReactToPostCommentInput {
  postId: string;
  commentId: string;
  type: "like";
}

export const useReactToPostComment = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId, type }: ReactToPostCommentInput) => {
      if (!user?.id) throw new Error("Authentication required");

      const { data: existing, error: fetchError } = await supabase
        .from("post_reactions" as any)
        .select("id, type")
        .eq("user_id", user.id)
        .eq("comment_id", commentId)
        .maybeSingle();
      if (fetchError) throw fetchError;

      const existingReaction = existing as { id: string; type: "like" | "dislike" | "sticker" } | null;
      if (existingReaction?.type === type) {
        const { error } = await supabase.from("post_reactions" as any).delete().eq("id", existingReaction.id);
        if (error) throw error;
        return { action: "removed" as const };
      }

      if (existingReaction?.id) {
        const { data, error } = await supabase
          .from("post_reactions" as any)
          .update({
            type,
            sticker_id: null,
            created_at: new Date().toISOString(),
          })
          .eq("id", existingReaction.id)
          .select()
          .single();
        if (error) throw error;
        return { action: "updated" as const, data };
      }

      const { data, error } = await supabase
        .from("post_reactions" as any)
        .insert({
          user_id: user.id,
          post_id: null,
          comment_id: commentId,
          type,
          sticker_id: null,
        })
        .select()
        .single();
      if (error) throw error;
      return { action: "inserted" as const, data };
    },
    onMutate: async (variables) => {
      const key = queryKeys.posts.comments(variables.postId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<PostComment[]>(key);
      if (previous) {
        queryClient.setQueryData(key, patchCommentsLike(previous, variables.commentId));
      }
      return { previous, key };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous && context.key) {
        queryClient.setQueryData(context.key, context.previous);
      }
    },
    onSettled: (_result, _error, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.posts.comments(variables.postId) });
    },
  });
};
