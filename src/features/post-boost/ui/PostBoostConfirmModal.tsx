import { Modal } from "react-native";
import { useTranslation } from "react-i18next";
import { AppPopupModal } from "@/shared/ui/app-popup";

export type PostBoostPopupMode = "confirm" | "cooldown";

type Props = {
  visible: boolean;
  mode: PostBoostPopupMode;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function PostBoostConfirmModal({ visible, mode, loading, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();
  const isCooldown = mode === "cooldown";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={loading ? undefined : onCancel}
    >
      <AppPopupModal
        embedded
        visible={visible}
        variant={isCooldown ? "alert" : "info"}
        title={isCooldown ? t("postBoost.cooldownTitle") : t("postBoost.confirmTitle")}
        message={
          loading
            ? t("postBoost.confirmLoading")
            : isCooldown
              ? t("postBoost.cooldownMessage")
              : t("postBoost.confirmMessage")
        }
        loading={loading && !isCooldown}
        onClose={loading ? () => {} : onCancel}
        buttons={
          loading && !isCooldown
            ? undefined
            : isCooldown
              ? [{ text: t("common.ok") }]
              : [
                  { text: t("postBoost.confirmCancel"), style: "cancel" },
                  {
                    text: t("postBoost.confirmAction"),
                    onPress: onConfirm,
                    skipCloseOnPress: true,
                  },
                ]
        }
      />
    </Modal>
  );
}
