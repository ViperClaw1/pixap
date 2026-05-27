import type { QueryClient } from "@tanstack/react-query";
import type { Profile } from "@/entities/user";
import { queryKeys } from "@/shared/api/queryKeys";
import type { StoryProfile } from "@/shared/model/types/stories";
import type { StoryComment } from "@/entities/story/api/useStoryComments";
import { feedCachesContainStory, patchStoryCommentInFeedCaches } from "./storyFeedCachePatch";

export type StoryDiscussionItemKind = "comment" | "reply";

function storyCommentsKey(storyId: string, userId: string | undefined | null) {
  return queryKeys.stories.commentsQuery(storyId, userId);
}

function profileToStoryProfile(userId: string, profile: Profile | null | undefined): StoryProfile | null {
  if (!profile) return null;
  return {
    id: userId,
    first_name: profile.first_name,
    last_name: profile.last_name,
    avatar_url: profile.avatar_url,
    username: profile.username,
  };
}

export function getOptimisticStoryAuthorProfile(
  queryClient: QueryClient,
  userId: string | undefined,
): StoryProfile | null {
  if (!userId) return null;
  const profile = queryClient.getQueryData<Profile>(queryKeys.profile.user(userId));
  return profileToStoryProfile(userId, profile);
}

export function patchStoryCommentContent(
  comments: StoryComment[],
  itemId: string,
  content: string,
): StoryComment[] {
  return comments.map((comment) => {
    if (comment.id === itemId) {
      return { ...comment, content };
    }
    const replyIndex = comment.replies.findIndex((reply) => reply.id === itemId);
    if (replyIndex < 0) return comment;
    const replies = [...comment.replies];
    replies[replyIndex] = { ...replies[replyIndex], content };
    return { ...comment, replies };
  });
}

export function removeStoryCommentFromCache(comments: StoryComment[], itemId: string): StoryComment[] {
  const asTopLevel = comments.filter((comment) => comment.id !== itemId);
  if (asTopLevel.length !== comments.length) return asTopLevel;

  return comments.map((comment) => ({
    ...comment,
    replies: comment.replies.filter((reply) => reply.id !== itemId),
  }));
}

export function addStoryTopCommentToCache(
  comments: StoryComment[],
  input: {
    optimisticId: string;
    storyId: string;
    userId: string;
    content: string;
    profile: StoryProfile | null;
  },
): StoryComment[] {
  const now = new Date().toISOString();
  return [
    ...comments,
    {
      id: input.optimisticId,
      story_id: input.storyId,
      user_id: input.userId,
      parent_id: null,
      content: input.content,
      created_at: now,
      profile: input.profile,
      replies: [],
      like_count: 0,
      liked_by_me: false,
    },
  ];
}

export function addStoryReplyToCache(
  comments: StoryComment[],
  input: {
    optimisticId: string;
    commentId: string;
    userId: string;
    content: string;
    profile: StoryProfile | null;
  },
): StoryComment[] {
  const now = new Date().toISOString();
  return comments.map((comment) => {
    if (comment.id !== input.commentId) return comment;
    return {
      ...comment,
      replies: [
        ...comment.replies,
        {
          id: input.optimisticId,
          comment_id: input.commentId,
          user_id: input.userId,
          content: input.content,
          created_at: now,
          profile: input.profile,
          like_count: 0,
          liked_by_me: false,
        },
      ],
    };
  });
}

type OptimisticTopCommentInput = {
  storyId: string;
  content: string;
};

type OptimisticReplyInput = {
  storyId: string;
  commentId: string;
  content: string;
};

export async function mutateOptimisticStoryTopCommentCreate(
  queryClient: QueryClient,
  userId: string | undefined,
  variables: OptimisticTopCommentInput,
) {
  const key = storyCommentsKey(variables.storyId, userId);
  await queryClient.cancelQueries({ queryKey: key });
  const previous = queryClient.getQueryData<StoryComment[]>(key);
  const trimmed = variables.content.trim();
  const optimisticId = `optimistic-${Date.now()}`;

  if (previous && userId && trimmed) {
    queryClient.setQueryData(
      key,
      addStoryTopCommentToCache(previous, {
        optimisticId,
        storyId: variables.storyId,
        userId,
        content: trimmed,
        profile: getOptimisticStoryAuthorProfile(queryClient, userId),
      }),
    );

    if (feedCachesContainStory(queryClient, variables.storyId)) {
      patchStoryCommentInFeedCaches(queryClient, variables.storyId, {
        commentCountDelta: 1,
        newComment: {
          id: optimisticId,
          content: trimmed,
          created_at: new Date().toISOString(),
        },
      });
    }
  }

  return { previous, key, storyId: variables.storyId };
}

export async function mutateOptimisticStoryReplyCreate(
  queryClient: QueryClient,
  userId: string | undefined,
  variables: OptimisticReplyInput,
) {
  const key = storyCommentsKey(variables.storyId, userId);
  await queryClient.cancelQueries({ queryKey: key });
  const previous = queryClient.getQueryData<StoryComment[]>(key);
  const trimmed = variables.content.trim();

  if (previous && userId && trimmed) {
    queryClient.setQueryData(
      key,
      addStoryReplyToCache(previous, {
        optimisticId: `optimistic-${Date.now()}`,
        commentId: variables.commentId,
        userId,
        content: trimmed,
        profile: getOptimisticStoryAuthorProfile(queryClient, userId),
      }),
    );
  }

  return { previous, key, storyId: variables.storyId };
}

export function rollbackOptimisticStoryComment(
  queryClient: QueryClient,
  context: { previous?: StoryComment[]; key?: readonly unknown[]; storyId?: string } | undefined,
) {
  if (context?.previous && context.key) {
    queryClient.setQueryData(context.key, context.previous);
  }
  if (context?.storyId) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.stories.comments(context.storyId) });
  }
}

export function settleOptimisticStoryComment(queryClient: QueryClient, storyId: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.stories.comments(storyId) });
}
