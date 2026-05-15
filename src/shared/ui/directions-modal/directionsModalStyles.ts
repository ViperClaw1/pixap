import { useMemo } from "react";
import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";

export const directionsModalStaticStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },

  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },

  sheetExpanded: {
    flex: 1,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },

  curtainWrap: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 2,
  },

  curtain: {
    width: 44,
    height: 5,
    borderRadius: 999,
    opacity: 0.65,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },

  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
  },

  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  address: {
    paddingHorizontal: 16,
    fontSize: 13,
    marginBottom: 8,
  },

  map: {
    width: "100%",
    minHeight: 220,
    flex: 1,
  },

  banner: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
  },

  bannerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  bannerIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  bannerText: {
    fontSize: 12,
    flex: 1,
    flexShrink: 1,
    lineHeight: 16,
  },

  errorBox: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
  },

  errorText: {
    fontSize: 12,
  },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 10,
  },

  metaRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },

  metaText: {
    fontSize: 13,
    fontWeight: "600",
  },

  modeRow: {
    flexDirection: "row",
    gap: 8,
  },

  modeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },

  modeChipActive: {},

  modeLabel: {
    fontSize: 12,
    fontWeight: "700",
  },

  modeLabelActive: {},

  closeBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },

  closeText: {
    fontSize: 14,
    fontWeight: "600",
  },

  configBox: {
    padding: 20,
  },

  configTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },

  configBody: {
    fontSize: 13,
    lineHeight: 20,
  },
});

export function directionsModalThemeStyles(
  colors: ThemeColors,
  isDark: boolean,
  topInset: number,
  bottomInset: number,
  screenH: number,
) {
  return {
    backdrop: {
      backgroundColor: colors.scrim,
    },
    sheet: {
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
    curtain: {
      backgroundColor: colors.textMuted,
    },
    headerTitle: {
      color: colors.text,
    },
    iconBtn: {
      backgroundColor: colors.border,
    },
    address: {
      color: colors.textMuted,
    },
    banner: {
      backgroundColor: isDark ? "rgba(234,179,8,0.15)" : "rgba(234,179,8,0.2)",
    },
    bannerIconBtn: {
      backgroundColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)",
    },
    bannerText: {
      color: colors.text,
    },
    errorBox: {
      backgroundColor: isDark ? "rgba(248,113,113,0.12)" : "rgba(220,38,38,0.08)",
    },
    errorText: {
      color: colors.danger,
    },
    metaText: {
      color: colors.text,
    },
    modeChip: {
      backgroundColor: colors.border,
    },
    modeChipActive: {
      backgroundColor: colors.primary,
    },
    modeLabel: {
      color: colors.text,
    },
    modeLabelActive: {
      color: colors.onPrimary,
    },
    closeText: {
      color: colors.link,
    },
    configTitle: {
      color: colors.text,
    },
    configBody: {
      color: colors.textMuted,
    },
    sheetExpanded: {
      marginTop: topInset,
      maxHeight: screenH,
    },
    footer: {
      paddingBottom: bottomInset,
    },
  } satisfies Partial<Record<keyof typeof directionsModalStaticStyles, object>>;
}

export function useDirectionsModalStyles(topInset: number, bottomInset: number, screenH: number) {
  const themed = useThemeStyles(
    ({ colors, isDark }) => directionsModalThemeStyles(colors, isDark, topInset, bottomInset, screenH),
    [topInset, bottomInset, screenH],
  );
  return useMemo(() => mergeStaticAndThemed(directionsModalStaticStyles, themed), [themed]);
}
