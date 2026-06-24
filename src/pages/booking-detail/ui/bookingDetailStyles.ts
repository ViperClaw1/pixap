import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";

export const bookingDetailStaticStyles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  hero: {
    width: "100%",
    height: 200,
    borderRadius: 16,
  },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  venueName: { fontSize: 22, fontWeight: "800" },
  meta: { fontSize: 14, lineHeight: 20 },
  price: { fontSize: 16, fontWeight: "700" },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  badge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  actions: { gap: 10, marginTop: 8 },
  primaryBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  secondaryBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  secondaryBtnText: { fontSize: 15, fontWeight: "700" },
  linkBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  linkBtnText: { fontSize: 14, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyText: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  statusTimeline: { gap: 8, marginTop: 2 },
  timelineRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  timelineDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, flexShrink: 0 },
  timelineDotActive: {},
  timelineText: { flex: 1, fontSize: 13, lineHeight: 18 },
});

export function bookingDetailThemeStyles(colors: ThemeColors) {
  return {
    section: { backgroundColor: colors.card, borderColor: colors.border },
    venueName: { color: colors.text },
    meta: { color: colors.textMuted },
    price: { color: colors.text },
    secondaryBtn: { borderColor: colors.border, backgroundColor: colors.card },
    secondaryBtnText: { color: colors.text },
    linkBtnText: { color: colors.primary },
    emptyText: { color: colors.textMuted },
    primaryBtn: { backgroundColor: colors.primary },
    timelineDot: { backgroundColor: colors.border },
    timelineDotActive: { backgroundColor: colors.primary },
    timelineText: { color: colors.textMuted },
  };
}
