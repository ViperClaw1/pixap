import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import type { useToggleFollow } from "@/entities/user";

export function useFollowOverrides(
  followingSet: Set<string>,
  toggleFollow: ReturnType<typeof useToggleFollow>,
) {
  const { t } = useTranslation();
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
            text1: result.nowFollowing ? t("messages.toastAddedFollowers") : t("messages.toastRemovedFollowers"),
            text2: displayName,
          });
        })
        .catch((error) => {
          setFollowOverrides((prev) => ({ ...prev, [authorId]: isFollowing }));
          Toast.show({
            type: "error",
            text1: t("messages.toastFollowFailed"),
            text2: error instanceof Error ? error.message : t("messages.toastTryAgain"),
          });
        });
    },
    [followOverrides, followingSet, t, toggleFollow],
  );

  return { followOverrides, onToggleFollowAuthor };
}
