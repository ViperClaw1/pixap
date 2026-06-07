import Toast from "react-native-toast-message";

export type AppToastType = "success" | "error" | "info";

type ShowToastOptions = {
  type?: AppToastType;
  title: string;
  message?: string;
  visibilityTime?: number;
};

/** Thin wrapper over react-native-toast-message for consistent non-blocking feedback. */
export function showToast({ type = "info", title, message, visibilityTime }: ShowToastOptions) {
  Toast.show({
    type: type === "info" ? "success" : type,
    text1: title,
    text2: message,
    visibilityTime: visibilityTime ?? (type === "error" ? 4000 : 3000),
  });
}

export function showSuccessToast(title: string, message?: string) {
  showToast({ type: "success", title, message });
}

export function showErrorToast(title: string, message?: string) {
  showToast({ type: "error", title, message });
}

export function showInfoToast(title: string, message?: string) {
  showToast({ type: "info", title, message });
}
