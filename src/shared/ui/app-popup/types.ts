export type AppPopupButtonStyle = "default" | "cancel" | "destructive";

export type AppPopupVariant = "success" | "alert" | "info";

export type AppPopupButton = {
  text: string;
  onPress?: () => void;
  style?: AppPopupButtonStyle;
  /** When true, the popup stays open after tap (e.g. async confirm with loading state). */
  skipCloseOnPress?: boolean;
};

import type { ReactNode } from "react";

export type AppPopupOptions = {
  title: string;
  message?: string | ReactNode;
  buttons?: AppPopupButton[];
  /** Shows an icon above the title: check (success), warning (alert), info (info). */
  variant?: AppPopupVariant;
  /** Hides actions and shows a spinner (buttons ignored). */
  loading?: boolean;
};

export type AppPopupState = AppPopupOptions & {
  visible: boolean;
};
