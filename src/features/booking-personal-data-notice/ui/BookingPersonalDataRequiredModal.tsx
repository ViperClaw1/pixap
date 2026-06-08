import { Modal } from "react-native";
import { useTranslation } from "react-i18next";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { AppPopupModal } from "@/shared/ui/app-popup";
import { navigateToEditProfile } from "@/app/navigation/navigationHelpers";

type Props = {
  visible: boolean;
  onClose: () => void;
  navigation: NavigationProp<ParamListBase>;
};

export function BookingPersonalDataRequiredModal({ visible, onClose, navigation }: Props) {
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <AppPopupModal
        embedded
        visible={visible}
        variant="info"
        title={t("bookingCommon.personalDataRequiredTitle")}
        message={t("bookingCommon.personalDataRequiredMessage")}
        onClose={onClose}
        buttons={[
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("bookingCommon.personalDataNoticeCta"),
            onPress: () => navigateToEditProfile(navigation),
          },
        ]}
      />
    </Modal>
  );
}
