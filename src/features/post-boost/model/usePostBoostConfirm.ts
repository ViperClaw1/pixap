import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import type { UseMutationResult } from "@tanstack/react-query";
import type { PostBoostPopupMode } from "../ui/PostBoostConfirmModal";
import { isPostBoostCooldownError, isPostBoostOnCooldown } from "../lib/postBoostCooldown";
import { waitPostBoostConfirmDelay } from "../lib/postBoostConfirmDelay";

type BoostMutation = UseMutationResult<
  { postId: string; boostedAt: string },
  Error,
  string,
  unknown
>;

type BoostPopupState =
  | { mode: "confirm"; postId: string }
  | { mode: "cooldown" }
  | null;

type Options = {
  boostPost: BoostMutation;
  onScrollFeedToTop: () => void;
};

export function usePostBoostConfirm({ boostPost, onScrollFeedToTop }: Options) {
  const { t } = useTranslation();
  const [popup, setPopup] = useState<BoostPopupState>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const showCooldownPopup = useCallback(() => {
    setPopup({ mode: "cooldown" });
  }, []);

  const requestBoost = useCallback(
    (postId: string, boostedAt: string | null | undefined) => {
      if (isPostBoostOnCooldown(boostedAt)) {
        showCooldownPopup();
        return;
      }
      setPopup({ mode: "confirm", postId });
    },
    [showCooldownPopup],
  );

  const cancelBoost = useCallback(() => {
    if (confirmLoading) return;
    setPopup(null);
  }, [confirmLoading]);

  const confirmBoost = useCallback(async () => {
    if (popup?.mode !== "confirm") return;
    const postId = popup.postId;
    if (confirmLoading) return;

    setConfirmLoading(true);
    try {
      await Promise.all([boostPost.mutateAsync(postId), waitPostBoostConfirmDelay()]);
      setPopup(null);
      setConfirmLoading(false);
      onScrollFeedToTop();
      Toast.show({
        type: "success",
        text1: t("postBoost.toastTitle"),
        text2: t("postBoost.toastMessage"),
      });
    } catch (error) {
      setConfirmLoading(false);
      if (isPostBoostCooldownError(error)) {
        setPopup({ mode: "cooldown" });
        return;
      }
      setPopup(null);
      const message = error instanceof Error ? error.message : t("postBoost.toastError");
      Toast.show({
        type: "error",
        text1: t("postBoost.toastErrorTitle"),
        text2: message,
      });
    }
  }, [
    boostPost,
    confirmLoading,
    onScrollFeedToTop,
    popup,
    t,
  ]);

  const isBoostPending = useCallback(
    (postId: string) =>
      popup?.mode === "confirm" &&
      ((confirmLoading && popup.postId === postId) ||
        (boostPost.isPending && boostPost.variables === postId)),
    [boostPost.isPending, boostPost.variables, confirmLoading, popup],
  );

  const popupMode: PostBoostPopupMode = popup?.mode ?? "confirm";

  return {
    confirmVisible: popup != null,
    popupMode,
    confirmLoading,
    requestBoost,
    cancelBoost,
    confirmBoost,
    isBoostPending,
  };
}
