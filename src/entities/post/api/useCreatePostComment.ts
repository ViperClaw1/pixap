import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface CreatePostCommentInput {
  postId: string;
  content: string;
  parentCommentId?: string | null;
}

export const useCreatePostComment = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, content, parentCommentId }: CreatePostCommentInput) => {
      if (!user?.id) throw new Error("Authentication required");
      const text = content.trim();
      if (!text) throw new Error("Comment cannot be empty");

      const { data, error } = await supabase
        .from("post_comments" as any)
        .insert({
          post_id: postId,
          user_id: user.id,
          parent_id: parentCommentId ?? null,
          content: text,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["post_comments", "post", variables.postId] });
      void queryClient.invalidateQueries({ queryKey: ["posts", "feed"] });
    },
  });
};
