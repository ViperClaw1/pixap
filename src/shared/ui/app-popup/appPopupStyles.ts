import { Platform, StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";

export const appPopupStaticStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    ...(Platform.OS === "android" ? { elevation: 24 } : null),
  },
  card: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    ...(Platform.OS === "android" ? { elevation: 16 } : null),
  },
  textBlock: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    gap: 8,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 24,
    letterSpacing: -0.2,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 20,
    textAlign: "center",
  },
  actions: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },
  actionFlex: {
    flex: 1,
    minWidth: 0,
  },
  btn: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  btnRow: {
    alignSelf: "stretch",
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  btnPressed: {
    opacity: 0.88,
  },
  btnText: {
    width: "100%",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
    textAlign: "center",
    flexShrink: 1,
  },
  btnPrimary: {},
  btnSecondary: {},
  btnDestructive: {},
  btnPrimaryText: {},
  btnSecondaryText: {},
  btnDestructiveText: {},
  btnGhostText: {},
});

export function appPopupThemeStyles(colors: ThemeColors) {
  return {
    overlay: {
      backgroundColor: colors.scrim,
    },
    card: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      ...(Platform.OS === "ios"
        ? {
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.18,
            shadowRadius: 24,
          }
        : null),
    },
    title: {
      color: colors.text,
    },
    message: {
      color: colors.textMuted,
    },
    btnPrimary: {
      backgroundColor: colors.accent,
    },
    btnPrimaryText: {
      color: colors.onAccent,
    },
    btnSecondary: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    btnSecondaryText: {
      color: colors.text,
    },
    btnDestructive: {
      backgroundColor: colors.dangerSurface,
      borderWidth: 1,
      borderColor: colors.dangerSurfaceStrong,
    },
    btnDestructiveText: {
      color: colors.danger,
    },
    btnGhostText: {
      color: colors.textMuted,
    },
  } satisfies Partial<Record<keyof typeof appPopupStaticStyles, object>>;
}

export function useAppPopupStyles() {
  const themed = useThemeStyles(({ colors }) => appPopupThemeStyles(colors));
  return mergeStaticAndThemed(appPopupStaticStyles, themed);
}
