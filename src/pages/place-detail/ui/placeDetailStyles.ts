import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";
import {
  SHARED_PRESSABLE_HEIGHT,
  SHARED_PRESSABLE_RADIUS,
  primaryPressableStyle,
  primaryPressableTextStyle,
} from "@/shared/theme/primaryPressable";

export const placeDetailStaticStyles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  hero: { width: "100%", height: 280 },
  heroBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    zIndex: 5,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnText: { fontSize: 18 },
  heroProgressWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 6,
  },
  heroDotsRow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 10,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  heroDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  heroDotActive: {},
  card: {
    marginTop: -24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    borderWidth: 0,
  },
  title: { fontSize: 22, fontWeight: "800" },
  rating: { marginTop: 6, fontSize: 14 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  tag: {
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  desc: { marginTop: 16, lineHeight: 22 },
  addr: { marginTop: 12 },
  actions: { flexDirection: "row", gap: 10, marginTop: 16 },
  secondaryBtn: {
    flex: 1,
    minHeight: SHARED_PRESSABLE_HEIGHT,
    borderRadius: SHARED_PRESSABLE_RADIUS,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: { fontWeight: "600" },
  primaryBtn: {
    marginTop: 16,
    ...primaryPressableStyle,
  },
  primaryBtnText: primaryPressableTextStyle,
  outlineBtn: {
    marginTop: 10,
    minHeight: SHARED_PRESSABLE_HEIGHT,
    borderRadius: SHARED_PRESSABLE_RADIUS,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  outlineBtnText: { fontWeight: "700" },
});

export function placeDetailThemeStyles(colors: ThemeColors) {
  return {
    root: { backgroundColor: colors.background },
    card: {
      backgroundColor: colors.background,
      borderColor: colors.background,
    },
    title: { color: colors.text },
    rating: { color: colors.textMuted },
    tag: {
      backgroundColor: colors.border,
      color: colors.text,
    },
    desc: { color: colors.textMuted },
    addr: { color: colors.text },
    secondaryBtn: { backgroundColor: colors.border },
    secondaryBtnText: { color: colors.text },
    outlineBtn: { borderColor: colors.primary },
    outlineBtnText: { color: colors.primary },
    iconBtn: { backgroundColor: colors.mediaOverlay },
    iconBtnText: { color: colors.mediaOverlayText },
    heroDot: { backgroundColor: colors.heroDot },
    heroDotActive: { backgroundColor: colors.heroDotActive },
  } satisfies Partial<Record<keyof typeof placeDetailStaticStyles, object>>;
}
