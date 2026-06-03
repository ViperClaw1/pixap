import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";

export const bookingFlowThemedStaticStyles = StyleSheet.create({
  headerBack: {},
  headerTitle: {},
  headerStep: {},
  sectionText: {},
  guestButton: {
    borderWidth: 1,
  },
  guestButtonText: {},
  guestCountText: {},
  calendarPanel: {
    borderWidth: 1,
  },
  calendarNavBtn: {
    borderWidth: 1,
  },
  calendarMonthTitle: {},
  calendarDowCell: {},
  calendarCellDayInner: {},
  calendarCellDayText: {},
  calendarCellToday: {},
  calendarCellSelected: {},
  calendarCellPast: { opacity: 0.42 },
  calendarCellPastText: {},
  timeCell: {
    borderWidth: 1,
  },
  timeCellText: {},
  timeCellSel: {},
  timeCellTextSel: { fontWeight: "700" },
  timeCellUnavailable: { opacity: 0.35 },
  confirmText: {},
  confirmPrice: {},
  footer: { borderTopWidth: 1 },
});

export function bookingFlowThemedThemeStyles(colors: ThemeColors, isDark: boolean) {
  return {
    headerBack: { color: colors.text },
    headerTitle: { color: colors.text },
    headerStep: { color: colors.textMuted },
    sectionText: { color: colors.text },
    guestButton: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    guestButtonText: { color: colors.text },
    guestCountText: { color: colors.text },
    calendarPanel: {
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
    calendarNavBtn: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    calendarMonthTitle: { color: colors.text },
    calendarDowCell: { color: colors.textMuted },
    calendarCellDayInner: { backgroundColor: colors.card },
    calendarCellDayText: { color: colors.text },
    calendarCellToday: { borderColor: colors.textMuted },
    calendarCellSelected: {
      borderColor: colors.text,
      backgroundColor: isDark ? "#262626" : "#f3f4f6",
    },
    calendarCellPastText: { color: colors.textMuted },
    timeCell: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    timeCellText: { color: colors.text },
    timeCellSel: { backgroundColor: colors.text, borderColor: colors.text },
    timeCellTextSel: { color: colors.background },
    timeCellUnavailable: { opacity: 0.35 },
    confirmText: { color: colors.text },
    confirmPrice: { color: colors.textMuted },
    footer: { borderTopColor: colors.border, backgroundColor: colors.background },
  } satisfies Partial<Record<keyof typeof bookingFlowThemedStaticStyles, object>>;
}
