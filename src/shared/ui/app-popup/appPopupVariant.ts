import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";
import type { ThemeColors } from "@/shared/theme/palettes";
import type { AppPopupVariant } from "./types";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

const SUCCESS_ICON_COLOR = "#22c55e";

export type AppPopupVariantMeta = {
  icon: IoniconName;
  iconColor: (colors: ThemeColors) => string;
  iconBackground: (colors: ThemeColors) => string;
};

export const APP_POPUP_VARIANT_META: Record<AppPopupVariant, AppPopupVariantMeta> = {
  success: {
    icon: "checkmark-circle",
    iconColor: () => SUCCESS_ICON_COLOR,
    iconBackground: (colors) => colors.successSurface,
  },
  alert: {
    icon: "warning",
    iconColor: (colors) => colors.warningBorder,
    iconBackground: (colors) => colors.dangerSurface,
  },
  info: {
    icon: "information-circle",
    iconColor: (colors) => colors.notification,
    iconBackground: (colors) => colors.accentSurface,
  },
};
