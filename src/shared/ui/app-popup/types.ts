export type AppPopupButtonStyle = "default" | "cancel" | "destructive";

export type AppPopupVariant = "success" | "alert" | "info";

export type AppPopupButton = {
  text: string;
  onPress?: () => void;
  style?: AppPopupButtonStyle;
};

export type AppPopupOptions = {
  title: string;
  message?: string;
  buttons?: AppPopupButton[];
  /** Shows an icon above the title: check (success), warning (alert), info (info). */
  variant?: AppPopupVariant;
};

export type AppPopupState = AppPopupOptions & {
  visible: boolean;
};
