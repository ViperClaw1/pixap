import type { QueryClient } from "@tanstack/react-query";
import type { Profile } from "@/entities/user";
import { queryKeys } from "@/shared/api/queryKeys";
import type { PostProfile } from "@/shared/model/types/posts";
import type { PostComment } from "@/entities/post/api/usePostComments";

export function patchPostCommentContent(
  comments: PostComment[],
  commentId: string,
  content: string,
): PostComment[] {
  return comments.map((comment) => {
    if (comment.id === commentId) {
      return { ...comment, content };
    }
    const replyIndex = comment.replies.findIndex((reply) => reply.id === commentId);
    if (replyIndex < 0) return comment;
    const replies = [...comment.replies];
    replies[replyIndex] = { ...replies[replyIndex], content };
    return { ...comment, replies };
  });
}

export function removePostCommentFromCache(comments: PostComment[], commentId: string): PostComment[] {
  const asTopLevel = comments.filter((comment) => comment.id !== commentId);
  if (asTopLevel.length !== comments.length) return asTopLevel;

  return comments.map((comment) => ({
    ...comment,
    replies: comment.replies.filter((reply) => reply.id !== commentId),
  }));
}

function profileToPostProfile(userId: string, profile: Profile | null | undefined): PostProfile | null {
  if (!profile) return null;
  return {
    id: userId,
    first_name: profile.first_name,
    last_name: profile.last_name,
    avatar_url: profile.avatar_url,
    username: profile.username,
  };
}

export function getOptimisticAuthorProfile(
  queryClient: QueryClient,
  userId: string | undefined,
): PostProfile | null {
  if (!userId) return null;
  const profile = queryClient.getQueryData<Profile>(queryKeys.profile.user(userId));
  return profileToPostProfile(userId, profile);
}

export function addPostCommentToCache(
  comments: PostComment[],
  input: {
    optimisticId: string;
    postId: string;
    userId: string;
    content: string;
    parentCommentId: string | null;
    profile: PostProfile | null;
  },
): PostComment[] {
  const now = new Date().toISOString();

  if (input.parentCommentId) {
    return comments.map((comment) => {
      if (comment.id !== input.parentCommentId) return comment;
      return {
        ...comment,
        replies: [
          ...comment.replies,
          {
            id: input.optimisticId,
            post_id: input.postId,
            user_id: input.userId,
            parent_id: input.parentCommentId!,
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

  return [
    ...comments,
    {
      id: input.optimisticId,
      post_id: input.postId,
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

type OptimisticCreateInput = {
  postId: string;
  content: string;
  parentCommentId?: string | null;
};

export async function mutateOptimisticPostCommentCreate(
  queryClient: QueryClient,
  userId: string | undefined,
  variables: OptimisticCreateInput,
) {
  const key = queryKeys.posts.comments(variables.postId);
  await queryClient.cancelQueries({ queryKey: key });
  const previous = queryClient.getQueryData<PostComment[]>(key);
  const trimmed = variables.content.trim();
  if (previous && userId && trimmed) {
    queryClient.setQueryData(
      key,
      addPostCommentToCache(previous, {
        optimisticId: `optimistic-${Date.now()}`,
        postId: variables.postId,
        userId,
        content: trimmed,
        parentCommentId: variables.parentCommentId ?? null,
        profile: getOptimisticAuthorProfile(queryClient, userId),
      }),
    );
  }
  return { previous, key };
}

export function rollbackOptimisticPostCommentCreate(
  queryClient: QueryClient,
  context: { previous?: PostComment[]; key?: readonly unknown[] } | undefined,
) {
  if (context?.previous && context.key) {
    queryClient.setQueryData(context.key, context.previous);
  }
}

export function settleOptimisticPostCommentCreate(
  queryClient: QueryClient,
  postId: string,
) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.posts.comments(postId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.posts.feedPrefix });
}
