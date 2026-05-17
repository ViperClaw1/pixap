import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/app/providers/AuthProvider";
import type { StoryReactionType } from "@/shared/model/types/stories";
import type { StoryComment } from "./useStoryComments";

function patchCommentsLike(
  comments: StoryComment[],
  commentId?: string,
  replyId?: string,
): StoryComment[] {
  if (commentId) {
    return comments.map((c) =>
      c.id === commentId
        ? {
            ...c,
            liked_by_me: !c.liked_by_me,
            like_count: Math.max(0, c.like_count + (c.liked_by_me ? -1 : 1)),
          }
        : c,
    );
  }
  if (replyId) {
    return comments.map((c) => ({
      ...c,
      replies: c.replies.map((r) =>
        r.id === replyId
          ? {
              ...r,
              liked_by_me: !r.liked_by_me,
              like_count: Math.max(0, r.like_count + (r.liked_by_me ? -1 : 1)),
            }
          : r,
      ),
    }));
  }
  return comments;
}

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

      const targetField = replyId ? "reply_id" : commentId ? "comment_id" : "story_id";
      const targetValue = replyId ?? commentId ?? storyId!;

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

      const reactionRow: Record<string, unknown> = {
        user_id: user.id,
        story_id: null,
        comment_id: null,
        reply_id: null,
        type,
        sticker_id: type === "sticker" ? stickerId ?? null : null,
      };
      if (replyId) {
        reactionRow.reply_id = replyId;
      } else if (commentId) {
        reactionRow.comment_id = commentId;
      } else {
        reactionRow.story_id = storyId;
      }

      const { data, error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tables are new and not yet in generated types
        .from("story_reactions" as any)
        .insert(reactionRow)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async (variables) => {
      if (!variables.storyId || (!variables.commentId && !variables.replyId)) return;
      const key = queryKeys.stories.commentsQuery(variables.storyId, user?.id);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<StoryComment[]>(key);
      if (previous) {
        queryClient.setQueryData(
          key,
          patchCommentsLike(previous, variables.commentId, variables.replyId),
        );
      }
      return { previous, key };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous != null && context.key) {
        queryClient.setQueryData(context.key, context.previous);
      }
    },
    onSettled: (_result, _error, variables) => {
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
