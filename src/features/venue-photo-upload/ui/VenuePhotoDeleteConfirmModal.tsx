import { Modal } from "react-native";
import { useTranslation } from "react-i18next";
import { AppPopupModal } from "@/shared/ui/app-popup";

type Props = {
  visible: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function VenuePhotoDeleteConfirmModal({ visible, loading = false, onConfirm, onClose }: Props) {
  const { t } = useTranslation();

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <AppPopupModal
        embedded
        visible
        variant="alert"
        title={t("placePhotoGrid.deleteConfirmTitle")}
        message={t("placePhotoGrid.deleteConfirmMessage")}
        loading={loading}
        onClose={onClose}
        buttons={[
          { text: t("placePhotoGrid.deleteCancel"), style: "cancel" },
          {
            text: t("placePhotoGrid.deleteConfirm"),
            style: "destructive",
            onPress: onConfirm,
            skipCloseOnPress: true,
          },
        ]}
      />
    </Modal>
  );
}
