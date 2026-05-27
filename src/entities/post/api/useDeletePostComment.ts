import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/app/providers/AuthProvider";
import { removePostCommentFromCache } from "@/entities/post/lib/postCommentCachePatch";
import type { PostComment } from "./usePostComments";

interface DeletePostCommentInput {
  postId: string;
  commentId: string;
}

export const useDeletePostComment = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, commentId }: DeletePostCommentInput) => {
      if (!user?.id) throw new Error("Authentication required");

      const { error } = await supabase
        .from("post_comments" as any)
        .delete()
        .eq("id", commentId)
        .eq("user_id", user.id)
        .eq("post_id", postId);
      if (error) throw error;
    },
    onMutate: async (variables) => {
      const key = queryKeys.posts.comments(variables.postId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<PostComment[]>(key);
      if (previous) {
        queryClient.setQueryData(key, removePostCommentFromCache(previous, variables.commentId));
      }
      return { previous, key };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous && context.key) {
        queryClient.setQueryData(context.key, context.previous);
      }
    },
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.posts.comments(variables.postId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.posts.feedPrefix });
    },
  });
};
