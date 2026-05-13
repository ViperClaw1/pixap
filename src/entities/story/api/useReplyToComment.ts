import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/contexts/AuthContext";

interface ReplyToCommentInput {
  storyId: string;
  commentId: string;
  content: string;
}

export const useReplyToComment = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ storyId: _storyId, commentId, content }: ReplyToCommentInput) => {
      if (!user?.id) throw new Error("Authentication required");
      const text = content.trim();
      if (!text) throw new Error("Reply cannot be empty");

      const { data, error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table types are not yet regenerated
        .from("story_replies" as any)
        .insert({
          comment_id: commentId,
          user_id: user.id,
          content: text,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.stories.comments(variables.storyId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.stories.feedPrefix });
      void queryClient.invalidateQueries({ queryKey: queryKeys.stories.strip });
    },
  });
};
