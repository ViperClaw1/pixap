import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  patchStoryCommentContent,
  type StoryDiscussionItemKind,
} from "@/entities/story/lib/storyCommentCachePatch";
import type { StoryComment } from "./useStoryComments";

interface UpdateStoryCommentInput {
  storyId: string;
  itemId: string;
  kind: StoryDiscussionItemKind;
  content: string;
}

export const useUpdateStoryComment = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ storyId, itemId, kind, content }: UpdateStoryCommentInput) => {
      if (!user?.id) throw new Error("Authentication required");
      const text = content.trim();
      if (!text) throw new Error("Comment cannot be empty");

      if (kind === "comment") {
        const { error } = await supabase
          .from("story_comments" as any)
          .update({ content: text })
          .eq("id", itemId)
          .eq("user_id", user.id)
          .eq("story_id", storyId);
        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .from("story_replies" as any)
        .update({ content: text })
        .eq("id", itemId)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onMutate: async (variables) => {
      const key = queryKeys.stories.commentsQuery(variables.storyId, user?.id);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<StoryComment[]>(key);
      const trimmed = variables.content.trim();
      if (previous) {
        queryClient.setQueryData(key, patchStoryCommentContent(previous, variables.itemId, trimmed));
      }
      return { previous, key };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous && context.key) {
        queryClient.setQueryData(context.key, context.previous);
      }
    },
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.stories.comments(variables.storyId) });
    },
  });
};
