import { useMemo } from "react";
import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";

export const storiesArchiveStaticStyles = StyleSheet.create({
  root: {
    flex: 1,
  },

  header: {
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontWeight: "700",
    fontSize: 17,
  },

  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },

  tabRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  tabBtn: {
    alignItems: "center",
    paddingVertical: 6,
    minWidth: 56,
  },

  tabUnderline: {
    marginTop: 6,
    height: 2,
    width: 28,
    borderRadius: 2,
  },

  emptyText: {
    textAlign: "center",
    marginTop: 32,
    paddingHorizontal: 24,
  },

  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 10,
  },

  monthTitle: {
    fontWeight: "700",
    fontSize: 16,
  },

  calRow: {
    flexDirection: "row",
  },

  calHeaderCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    minWidth: 0,
  },

  calDaySlot: {
    flex: 1,
    minWidth: 0,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },

  calWeekLabel: {
    fontSize: 11,
  },

  calDayNum: {
    fontSize: 13,
    textAlign: "center",
  },

  calCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 2,
  },

  clusterBubble: {
    minWidth: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },

  clusterCount: {
    fontWeight: "800",
    fontSize: 15,
  },

  mapMarkerThumb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
  },

  mapMarkerThumbEmpty: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
  },
});

export function storiesArchiveThemeStyles(colors: ThemeColors, topInset: number) {
  return {
    root: {
      backgroundColor: colors.background,
    },
    header: {
      borderBottomColor: colors.border,
    },
    headerTitle: {
      color: colors.text,
    },
    iconBtn: {
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    tabRow: {
      borderBottomColor: colors.border,
    },
    tabUnderline: {
      backgroundColor: colors.primary,
    },
    emptyText: {
      color: colors.textMuted,
    },
    monthTitle: {
      color: colors.text,
    },
    calWeekLabel: {
      color: colors.textMuted,
    },
    calDayNum: {
      color: colors.text,
    },
    calCircle: {
      borderColor: colors.border,
    },
    clusterBubble: {
      backgroundColor: colors.card,
      borderColor: colors.primary,
    },
    clusterCount: {
      color: colors.text,
    },
    mapMarkerThumb: {
      borderColor: "#fff",
    },
    mapMarkerThumbEmpty: {
      borderColor: "#fff",
      backgroundColor: colors.card,
    },
    header: {
      paddingTop: Math.max(topInset, 10),
    },
  } satisfies Partial<Record<keyof typeof storiesArchiveStaticStyles, object>>;
}

export function useStoriesArchiveStyles(topInset: number) {
  const themed = useThemeStyles(
    ({ colors }) => storiesArchiveThemeStyles(colors, topInset),
    [topInset],
  );
  return useMemo(() => mergeStaticAndThemed(storiesArchiveStaticStyles, themed), [themed]);
}
