import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";

const staticStyles = StyleSheet.create({
  card: {
    marginTop: 24,
    borderWidth: 2,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    overflow: "hidden",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
    flexShrink: 1,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  warningText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  confirmLabel: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  confirmHint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  input: {
    minHeight: 48,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 4,
  },
  matchFeedbackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  matchFeedbackText: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  deleteBtn: {
    marginTop: 4,
    minHeight: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  deleteBtnDisabled: {
    opacity: 0.55,
  },
  deleteBtnText: {
    fontSize: 15,
    fontWeight: "700",
  },
  deleteBtnDisabledText: {
    opacity: 0.8,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
    paddingBottom: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    gap: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  modalBody: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  modalButtonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: "700",
  },
  confirmDeleteBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  confirmDeleteBtnText: {
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
      color: colors.text,
      opacity: 0.8,
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
    matchFeedbackRow: {
      backgroundColor: colors.background,
    },
    matchFeedbackText: {
      color: colors.text,
    },
    deleteBtn: {
      backgroundColor: colors.danger,
    },
    deleteBtnText: {
      color: colors.onPrimary,
    },
    modalContent: {
      backgroundColor: colors.card,
    },
    modalTitle: {
      color: colors.danger,
    },
    modalBody: {
      color: colors.text,
    },
    cancelBtn: {
      borderColor: colors.border,
    },
    cancelBtnText: {
      color: colors.text,
    },
    confirmDeleteBtn: {
      backgroundColor: colors.danger,
    },
    confirmDeleteBtnText: {
      color: colors.onPrimary,
    },
  } satisfies Partial<Record<keyof typeof staticStyles, object>>;
}

export function useProfileDangerZoneStyles() {
  const themed = useThemeStyles(({ colors }) => themeStyles(colors));
  return mergeStaticAndThemed(staticStyles, themed);
}
