import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/app/providers/AuthProvider";

interface UpdatePostCommentInput {
  postId: string;
  commentId: string;
  content: string;
}

export const useUpdatePostComment = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, commentId, content }: UpdatePostCommentInput) => {
      if (!user?.id) throw new Error("Authentication required");
      const text = content.trim();
      if (!text) throw new Error("Comment cannot be empty");

      const { error } = await supabase
        .from("post_comments" as any)
        .update({ content: text })
        .eq("id", commentId)
        .eq("user_id", user.id)
        .eq("post_id", postId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.posts.comments(variables.postId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.posts.feedPrefix });
    },
  });
};
