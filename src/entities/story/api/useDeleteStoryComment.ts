import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  removeStoryCommentFromCache,
  type StoryDiscussionItemKind,
} from "@/entities/story/lib/storyCommentCachePatch";
import { feedCachesContainStory, patchStoryCommentInFeedCaches } from "@/entities/story/lib/storyFeedCachePatch";
import type { StoryComment } from "./useStoryComments";

interface DeleteStoryCommentInput {
  storyId: string;
  itemId: string;
  kind: StoryDiscussionItemKind;
}

export const useDeleteStoryComment = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ storyId, itemId, kind }: DeleteStoryCommentInput) => {
      if (!user?.id) throw new Error("Authentication required");

      if (kind === "comment") {
        const { data, error } = await supabase
          .from("story_comments" as any)
          .delete()
          .eq("id", itemId)
          .eq("user_id", user.id)
          .eq("story_id", storyId)
          .select("id");
        if (error) throw error;
        if (!data?.length) throw new Error("Could not delete comment");
        return;
      }

      const { data, error } = await supabase
        .from("story_replies" as any)
        .delete()
        .eq("id", itemId)
        .eq("user_id", user.id)
        .select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Could not delete reply");
    },
    onMutate: async (variables) => {
      const key = queryKeys.stories.commentsQuery(variables.storyId, user?.id);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<StoryComment[]>(key);
      if (previous) {
        queryClient.setQueryData(key, removeStoryCommentFromCache(previous, variables.itemId));
      }

      if (variables.kind === "comment" && feedCachesContainStory(queryClient, variables.storyId)) {
        patchStoryCommentInFeedCaches(queryClient, variables.storyId, {
          commentCountDelta: -1,
          removedCommentId: variables.itemId,
        });
      }

      return { previous, key, storyId: variables.storyId };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous && context.key) {
        queryClient.setQueryData(context.key, context.previous);
      }
      if (context?.storyId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.stories.comments(context.storyId) });
      }
    },
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.stories.comments(variables.storyId) });
    },
  });
};
