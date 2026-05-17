import { Modal, Platform } from "react-native";
import { AppPopupModal } from "./AppPopupModal";
import { useAppPopupContext } from "./AppPopupContext";

/** Mount once at app root (sibling to NavigationContainer) so alerts sit above screen content. */
export function AppPopupHost() {
  const { state, hide } = useAppPopupContext();

  return (
    <Modal
      visible={state.visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent={Platform.OS === "android"}
      onRequestClose={hide}
    >
      <AppPopupModal
        visible={state.visible}
        title={state.title}
        message={state.message}
        buttons={state.buttons}
        variant={state.variant}
        onClose={hide}
      />
    </Modal>
  );
}
