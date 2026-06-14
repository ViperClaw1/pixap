import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";
import { radii } from "@/shared/theme/radii";
import {
  SHARED_PRESSABLE_HEIGHT,
  SHARED_PRESSABLE_RADIUS,
  primaryPressableStyle,
  primaryPressableTextStyle,
} from "@/shared/theme/primaryPressable";

export const PLACE_DETAIL_HERO_HEIGHT = 360;
/** Call / directions row — slightly below default 56px pressable height. */
export const PLACE_DETAIL_ACTION_BTN_HEIGHT = 44;
const PLACE_DETAIL_STICKY_BTN_HEIGHT = 44;
/** Equal vertical inset inside sticky bar (above tab bar, not safe-area). */
const PLACE_DETAIL_STICKY_VERTICAL_PAD = 10;

export type PlaceDetailStickyLayout = {
  barHeight: number;
  bottomPad: number;
  topPad: number;
  scrollTailPad: number;
};

/** Sticky booking bar + scroll tail spacing. */
export function resolvePlaceDetailStickyLayout(_insetsBottom: number): PlaceDetailStickyLayout {
  // Tab stacks sit above the tab bar; do not apply full safe-area bottom inset again.
  const verticalPad = PLACE_DETAIL_STICKY_VERTICAL_PAD;
  return {
    barHeight: verticalPad + PLACE_DETAIL_STICKY_BTN_HEIGHT + verticalPad,
    bottomPad: verticalPad,
    topPad: verticalPad,
    scrollTailPad: 4,
  };
}

/** Hero footer uses 16px horizontal inset on each side. */
export function resolveHeroSeeAllBadgeMaxWidth(windowWidth: number): number {
  const contentWidth = Math.max(320, windowWidth) - 32;
  return Math.max(104, Math.min(Math.floor(contentWidth * 0.56), contentWidth - 72));
}

export function resolveHeroSeeAllPhotosFontSize(label: string, badgeMaxWidth: number): number {
  const innerWidth = Math.max(56, badgeMaxWidth - 20);
  for (let size = 11; size >= 9; size -= 0.5) {
    const approxTextWidth = label.length * size * 0.56;
    if (approxTextWidth <= innerWidth) return size;
  }
  return 9;
}
export const HERO_OVERLAY_ICON_COLOR = "#ffffff";
export const HERO_OVERLAY_BTN_BG = "rgba(0,0,0,0.55)";
export const HERO_OVERLAY_BTN_BORDER = "rgba(255,255,255,0.32)";
/** White content card overlaps hero by this amount (see `card.marginTop`). */
export const PLACE_DETAIL_CARD_HERO_OVERLAP = 24;
/** Visible inset of hero footer above the card overlap + breathing room. */
export const PLACE_DETAIL_HERO_FOOTER_BOTTOM =
  PLACE_DETAIL_CARD_HERO_OVERLAP + 16;

export const placeDetailStaticStyles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  heroWrap: { width: "100%", height: PLACE_DETAIL_HERO_HEIGHT, overflow: "hidden" },
  heroMediaLayer: { width: "100%", height: PLACE_DETAIL_HERO_HEIGHT },
  hero: { width: "100%", height: PLACE_DETAIL_HERO_HEIGHT },
  heroGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: PLACE_DETAIL_HERO_HEIGHT * 0.5,
    zIndex: 2,
  },
  heroFooter: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: PLACE_DETAIL_HERO_FOOTER_BOTTOM,
    zIndex: 5,
    gap: 8,
    paddingBottom: 4,
  },
  heroInfoRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  heroInfoText: {
    flex: 1,
    minWidth: 0,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#ffffff",
    lineHeight: 28,
  },
  heroRating: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.88)",
  },
  heroStoriesBadge: {
    position: "absolute",
    right: 16,
    top: 0,
    zIndex: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  heroStoriesBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ffffff",
  },
  heroBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 6,
  },
  heroBarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: HERO_OVERLAY_BTN_BG,
    borderWidth: 1,
    borderColor: HERO_OVERLAY_BTN_BORDER,
  },
  heroBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: HERO_OVERLAY_BTN_BG,
    borderWidth: 1,
    borderColor: HERO_OVERLAY_BTN_BORDER,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    alignSelf: "center",
  },
  heroDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  heroDotActive: {},
  heroSeeAllBadge: {
    flexShrink: 1,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  heroSeeAllBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#ffffff",
    lineHeight: 14,
  },
  card: {
    marginTop: -PLACE_DETAIL_CARD_HERO_OVERLAP,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    borderWidth: 0,
  },
  cardAndroid: {
    paddingBottom: 8,
  },
  title: { fontSize: 22, fontWeight: "800" },
  rating: { marginTop: 6, fontSize: 14 },
  crowdCard: {
    marginTop: 14,
    minHeight: 140,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  crowdBadge: { gap: 4 },
  crowdTitle: { fontSize: 13, lineHeight: 16, fontWeight: "700" },
  crowdHeadline: { fontSize: 16, lineHeight: 19, fontWeight: "800" },
  crowdMeta: { marginTop: 6, fontSize: 12, lineHeight: 15 },
  crowdCheckInBtn: {
    marginTop: 12,
    minHeight: 40,
    borderRadius: SHARED_PRESSABLE_RADIUS,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  crowdCheckInText: { fontWeight: "700", fontSize: 14 },
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
  callBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: PLACE_DETAIL_ACTION_BTN_HEIGHT,
    borderRadius: SHARED_PRESSABLE_RADIUS,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  callBtnText: { fontWeight: "700", fontSize: 14 },
  directionsBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: PLACE_DETAIL_ACTION_BTN_HEIGHT,
    borderRadius: SHARED_PRESSABLE_RADIUS,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  directionsBtnText: { fontWeight: "700", fontSize: 14 },
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
  stickyBookingBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    zIndex: 20,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  stickyBtnWrap: {
    flex: 1,
    minHeight: PLACE_DETAIL_STICKY_BTN_HEIGHT,
    borderRadius: SHARED_PRESSABLE_RADIUS,
    overflow: "hidden",
  },
  stickyPrimaryBtn: {
    flex: 1,
    minHeight: PLACE_DETAIL_STICKY_BTN_HEIGHT,
    borderRadius: SHARED_PRESSABLE_RADIUS,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  stickyPrimaryBtnText: { fontWeight: "700", fontSize: 15 },
  stickyPixAIBtn: {
    flex: 1,
    minHeight: PLACE_DETAIL_STICKY_BTN_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
  },
  stickyPixAIBtnIcon: {
    position: "absolute",
    left: 12,
  },
  stickyPixAIBtnText: {
    fontWeight: "800",
    fontSize: 14,
    color: "#ffffff",
    textAlign: "center",
    width: "100%",
  },
});

export function placeDetailThemeStyles(colors: ThemeColors, isDark: boolean) {
  return {
    root: { backgroundColor: colors.background },
    card: {
      backgroundColor: colors.background,
      borderColor: colors.background,
    },
    title: { color: colors.text },
    rating: { color: colors.textMuted },
    crowdCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    crowdTitle: { color: colors.text },
    crowdMeta: { color: colors.textMuted },
    crowdCheckInBtn: { backgroundColor: colors.primary },
    crowdCheckInText: { color: colors.onPrimary },
    tag: {
      backgroundColor: colors.border,
      color: colors.text,
    },
    desc: { color: colors.textMuted },
    addr: { color: colors.text },
    callBtn: {
      backgroundColor: colors.accentSurface,
      borderColor: colors.accent,
    },
    callBtnText: { color: colors.accent },
    directionsBtn: {
      backgroundColor: isDark ? "rgba(96,165,250,0.22)" : "rgba(37,99,235,0.12)",
      borderColor: colors.link,
    },
    directionsBtnText: { color: colors.link },
    outlineBtn: { borderColor: colors.primary },
    outlineBtnText: { color: colors.primary },
    stickyBookingBar: {
      backgroundColor: colors.background,
      borderTopColor: colors.border,
    },
    stickyPrimaryBtn: { backgroundColor: colors.primary },
    stickyPrimaryBtnText: { color: colors.onPrimary },
    heroDot: { backgroundColor: colors.heroDot },
    heroDotActive: { backgroundColor: colors.heroDotActive },
  } satisfies Partial<Record<keyof typeof placeDetailStaticStyles, object>>;
}
