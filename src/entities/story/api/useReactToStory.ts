import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/contexts/AuthContext";
import type { StoryReactionType } from "@/types/stories";

interface ReactToStoryInput {
  storyId?: string;
  commentId?: string;
  replyId?: string;
  type: StoryReactionType;
  stickerId?: string | null;
}

export const useReactToStory = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ storyId, commentId, replyId, type, stickerId }: ReactToStoryInput) => {
      if (!user?.id) throw new Error("Authentication required");
      if (!storyId && !commentId && !replyId) throw new Error("Reaction target is required");

      const targetField = replyId ? "reply_id" : storyId ? "story_id" : "comment_id";
      const targetValue = replyId ?? storyId ?? commentId!;

      const { data: existing, error: fetchError } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tables are new and not yet in generated types
        .from("story_reactions" as any)
        .select("id, type")
        .eq("user_id", user.id)
        .eq(targetField, targetValue)
        .maybeSingle();

      if (fetchError) throw fetchError;
      const existingReaction = existing as { id: string; type: StoryReactionType } | null;

      if (existingReaction?.type === type) {
        const { error } = await supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tables are new and not yet in generated types
          .from("story_reactions" as any)
          .delete()
          .eq("id", existingReaction.id);
        if (error) throw error;
        return { action: "removed" as const };
      }

      if (existingReaction?.id) {
        const { data, error } = await supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tables are new and not yet in generated types
          .from("story_reactions" as any)
          .update({
            type,
            sticker_id: type === "sticker" ? stickerId ?? null : null,
            created_at: new Date().toISOString(),
          })
          .eq("id", existingReaction.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }

      const { data, error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tables are new and not yet in generated types
        .from("story_reactions" as any)
        .insert({
          user_id: user.id,
          story_id: storyId ?? null,
          comment_id: commentId ?? null,
          reply_id: replyId ?? null,
          type,
          sticker_id: type === "sticker" ? stickerId ?? null : null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_result, variables) => {
      if (variables.storyId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.stories.feedPrefix });
        void queryClient.invalidateQueries({ queryKey: queryKeys.stories.strip });
        void queryClient.invalidateQueries({ queryKey: queryKeys.stories.reactions(variables.storyId) });
      }
      if (variables.commentId || variables.replyId) {
        if (variables.storyId) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.stories.comments(variables.storyId) });
        } else {
          void queryClient.invalidateQueries({ queryKey: queryKeys.stories.commentsStoryPrefix });
        }
      }
    },
  });
};
