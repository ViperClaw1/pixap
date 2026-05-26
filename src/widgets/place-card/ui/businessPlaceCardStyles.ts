import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";

const IMAGE_HORIZONTAL = 96;
const IMAGE_VERTICAL_W = 200;
const IMAGE_VERTICAL_H = 140;

export const businessPlaceCardStaticStyles = StyleSheet.create({
  hRoot: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    width: "100%",
  },
  hImageWrap: {
    width: IMAGE_HORIZONTAL,
    height: IMAGE_HORIZONTAL,
    borderRadius: 12,
    overflow: "hidden",
    flexShrink: 0,
  },
  hImage: { width: "100%", height: "100%" },
  imageEmpty: { width: "100%", height: "100%" },
  hHeartBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  hBody: { flex: 1, minWidth: 0, justifyContent: "space-between", paddingVertical: 2 },
  hTitle: { fontSize: 16, fontWeight: "600", lineHeight: 20 },
  hAddress: { fontSize: 12, marginTop: 4, lineHeight: 16 },
  hTagsRow: { flexDirection: "row", flexWrap: "nowrap", gap: 6, marginTop: 8, overflow: "hidden" },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    maxWidth: "100%",
  },
  tagText: {
    fontSize: 10,
    fontWeight: "500",
  },
  vRoot: { width: IMAGE_VERTICAL_W, flexShrink: 0 },
  vImageBlock: {
    width: IMAGE_VERTICAL_W,
    height: IMAGE_VERTICAL_H,
    borderRadius: 12,
    overflow: "hidden",
  },
  vImage: { width: "100%", height: "100%" },
  vHeartBtn: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  vRatingPill: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  vRatingText: { fontSize: 12, fontWeight: "600" },
  vMeta: { marginTop: 8, paddingHorizontal: 2 },
  vName: { fontSize: 14, fontWeight: "600" },
  vTagsRow: { flexDirection: "row", flexWrap: "nowrap", gap: 6, marginTop: 6, overflow: "hidden" },
  vTagPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: "100%",
  },
  vTagText: {
    fontSize: 10,
    fontWeight: "600",
  },
});

export function businessPlaceCardThemeStyles(colors: ThemeColors) {
  return {
    hRoot: {
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
    imageEmpty: { backgroundColor: colors.border },
    hHeartBtn: { backgroundColor: colors.mediaOverlay },
    hTitle: { color: colors.text },
    hAddress: { color: colors.textMuted },
    tagPill: { backgroundColor: colors.tagMuted },
    tagText: { color: colors.tagMutedText },
    vImageBlock: { backgroundColor: colors.border },
    vHeartBtn: { backgroundColor: colors.mediaOverlay },
    vRatingPill: { backgroundColor: colors.mediaOverlay },
    vRatingText: { color: colors.text },
    vName: { color: colors.text },
    vTagPill: {
      backgroundColor: colors.tagMuted,
      borderColor: colors.border,
    },
    vTagText: { color: colors.tagMutedText },
  } satisfies Partial<Record<keyof typeof businessPlaceCardStaticStyles, object>>;
}
