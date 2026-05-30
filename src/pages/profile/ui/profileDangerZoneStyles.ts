import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";

const staticStyles = StyleSheet.create({
  card: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
    flexShrink: 1,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
  },
  warningText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  confirmLabel: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "700",
  },
  confirmHint: {
    fontSize: 12,
    lineHeight: 17,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginTop: 2,
  },
  deleteBtn: {
    marginTop: 8,
    minHeight: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  deleteBtnDisabled: {
    opacity: 0.45,
  },
  deleteBtnText: {
    fontSize: 15,
    fontWeight: "700",
  },
});

function themeStyles(colors: ThemeColors) {
  return {
    card: {
      borderColor: colors.danger,
      backgroundColor: colors.card,
    },
    title: {
      color: colors.danger,
    },
    description: {
      color: colors.textMuted,
    },
    warningText: {
      color: colors.danger,
    },
    confirmLabel: {
      color: colors.text,
    },
    confirmHint: {
      color: colors.textMuted,
    },
    input: {
      borderColor: colors.border,
      color: colors.text,
      backgroundColor: colors.background,
    },
    deleteBtn: {
      backgroundColor: colors.danger,
    },
    deleteBtnText: {
      color: colors.onPrimary,
    },
  } satisfies Partial<Record<keyof typeof staticStyles, object>>;
}

export function useProfileDangerZoneStyles() {
  const themed = useThemeStyles(({ colors }) => themeStyles(colors));
  return mergeStaticAndThemed(staticStyles, themed);
}
