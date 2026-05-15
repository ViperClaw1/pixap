import { useCallback, useState } from "react";
import type { useReactToPost } from "@/entities/post";

export function usePostLikes(reactToPost: ReturnType<typeof useReactToPost>) {
  const [likes, setLikes] = useState<Record<string, true>>({});
  const [likeCount, setLikeCount] = useState<Record<string, number>>({});

  const togglePostLike = useCallback(
    (postId: string, reactionCount: number, runAuthedAction: (fn: () => void) => void) => {
      runAuthedAction(() => {
        const wasLiked = !!likes[postId];
        setLikes((prev) => {
          if (wasLiked) {
            const { [postId]: _removed, ...rest } = prev;
            return rest;
          }
          return { ...prev, [postId]: true };
        });
        setLikeCount((prev) => ({
          ...prev,
          [postId]: Math.max(0, (prev[postId] ?? reactionCount) + (wasLiked ? -1 : 1)),
        }));
        void reactToPost.mutateAsync({ postId, type: "like" }).catch(() => {
          setLikes((prev) => {
            if (wasLiked) return { ...prev, [postId]: true };
            const { [postId]: _removed, ...rest } = prev;
            return rest;
          });
          setLikeCount((prev) => ({
            ...prev,
            [postId]: Math.max(0, (prev[postId] ?? reactionCount) + (wasLiked ? 1 : -1)),
          }));
        });
      });
    },
    [likes, reactToPost],
  );

  return { likes, likeCount, togglePostLike };
}
