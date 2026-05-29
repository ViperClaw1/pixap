import { Modal } from "react-native";
import { useTranslation } from "react-i18next";
import { AppPopupModal } from "@/shared/ui/app-popup";

type Props = {
  visible: boolean;
  loading?: boolean;
  onAllow: () => void;
  onDecline: () => void;
};

export function AiDataConsentModal({ visible, loading = false, onAllow, onDecline }: Props) {
  const { t } = useTranslation();

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDecline}>
      <AppPopupModal
        embedded
        visible
        variant="info"
        title={t("aiConsent.title")}
        message={`${t("aiConsent.providerLabel")}\n\n${t("aiConsent.message")}`}
        loading={loading}
        onClose={onDecline}
        buttons={[
          { text: t("aiConsent.decline"), style: "cancel", onPress: onDecline },
          { text: t("aiConsent.allow"), onPress: onAllow },
        ]}
      />
    </Modal>
  );
}
