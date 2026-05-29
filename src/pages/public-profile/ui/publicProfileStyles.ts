import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";

export const publicProfileStaticStyles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  headerSpacer: {
    width: 40,
  },
  hero: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 20,
    gap: 8,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  username: {
    fontSize: 14,
    textAlign: "center",
  },
  bioCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  bioLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  bioText: {
    fontSize: 15,
    lineHeight: 22,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  centerStateText: {
    fontSize: 16,
    textAlign: "center",
  },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
});

export function publicProfileThemeStyles(colors: ThemeColors) {
  return {
    screen: { backgroundColor: colors.background },
    headerTitle: { color: colors.text },
    name: { color: colors.text },
    username: { color: colors.textMuted },
    bioCard: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
    bioLabel: { color: colors.textMuted },
    bioText: { color: colors.text },
    followBtnActive: { backgroundColor: colors.accentSurface, borderColor: colors.accent },
    followBtnInactive: { backgroundColor: colors.background, borderColor: colors.border },
    followBtnTextActive: { color: colors.accent },
    followBtnTextInactive: { color: colors.text },
    messageBtn: { backgroundColor: colors.accent, borderColor: colors.accent },
    messageBtnText: { color: colors.onAccent },
    centerStateText: { color: colors.textMuted },
    retryBtn: { backgroundColor: colors.accent },
    retryBtnText: { color: colors.onAccent },
  };
}
