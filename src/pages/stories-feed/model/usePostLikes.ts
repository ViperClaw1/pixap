import { useCallback, useReducer } from "react";
import { unstable_batchedUpdates } from "react-native";
import type { useReactToPost } from "@/entities/post";

type LikeState = {
  likes: Record<string, true>;
  likeCount: Record<string, number>;
};

type LikeAction =
  | { type: "toggle"; postId: string; reactionCount: number }
  | { type: "revert"; postId: string; reactionCount: number; wasLiked: boolean };

function likeReducer(state: LikeState, action: LikeAction): LikeState {
  if (action.type === "revert") {
    const { postId, reactionCount, wasLiked } = action;
    if (wasLiked) {
      return {
        likes: { ...state.likes, [postId]: true },
        likeCount: {
          ...state.likeCount,
          [postId]: Math.max(0, (state.likeCount[postId] ?? reactionCount) + 1),
        },
      };
    }
    const { [postId]: _removed, ...likes } = state.likes;
    return {
      likes,
      likeCount: {
        ...state.likeCount,
        [postId]: Math.max(0, (state.likeCount[postId] ?? reactionCount) - 1),
      },
    };
  }

  const { postId, reactionCount } = action;
  const wasLiked = !!state.likes[postId];
  if (wasLiked) {
    const { [postId]: _removed, ...likes } = state.likes;
    return {
      likes,
      likeCount: {
        ...state.likeCount,
        [postId]: Math.max(0, (state.likeCount[postId] ?? reactionCount) - 1),
      },
    };
  }
  return {
    likes: { ...state.likes, [postId]: true },
    likeCount: {
      ...state.likeCount,
      [postId]: Math.max(0, (state.likeCount[postId] ?? reactionCount) + 1),
    },
  };
}

export function usePostLikes(reactToPost: ReturnType<typeof useReactToPost>) {
  const [{ likes, likeCount }, dispatch] = useReducer(likeReducer, { likes: {}, likeCount: {} });

  const togglePostLike = useCallback(
    (postId: string, reactionCount: number, runAuthedAction: (fn: () => void) => void) => {
      runAuthedAction(() => {
        const wasLiked = !!likes[postId];
        unstable_batchedUpdates(() => {
          dispatch({ type: "toggle", postId, reactionCount });
        });
        void reactToPost.mutateAsync({ postId, type: "like" }).catch(() => {
          unstable_batchedUpdates(() => {
            dispatch({ type: "revert", postId, reactionCount, wasLiked });
          });
        });
      });
    },
    [likes, reactToPost],
  );

  return { likes, likeCount, togglePostLike };
}
