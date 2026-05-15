import { useCallback, useState } from "react";
import Toast from "react-native-toast-message";
import type { useToggleFollow } from "@/entities/user";

export function useFollowOverrides(
  followingSet: Set<string>,
  toggleFollow: ReturnType<typeof useToggleFollow>,
) {
  const [followOverrides, setFollowOverrides] = useState<Record<string, boolean>>({});

  const onToggleFollowAuthor = useCallback(
    (authorId: string, displayName: string) => {
      const isFollowing = followOverrides[authorId] ?? followingSet.has(authorId);
      setFollowOverrides((prev) => ({ ...prev, [authorId]: !isFollowing }));
      void toggleFollow
        .mutateAsync({ followingId: authorId, isFollowing })
        .then((result) => {
          if (result.skipped) return;
          Toast.show({
            type: "success",
            text1: result.nowFollowing ? "Added to followers" : "Removed from followers",
            text2: displayName,
          });
        })
        .catch((error) => {
          setFollowOverrides((prev) => ({ ...prev, [authorId]: isFollowing }));
          Toast.show({
            type: "error",
            text1: "Follow action failed",
            text2: error instanceof Error ? error.message : "Please try again.",
          });
        });
    },
    [followOverrides, followingSet, toggleFollow],
  );

  return { followOverrides, onToggleFollowAuthor };
}
