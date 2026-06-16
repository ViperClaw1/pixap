import { useMemo } from "react";
import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";
import { radii } from "@/shared/theme/radii";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";

export const BOOKING_FLOW_HERO_HEIGHT = 340;

export const BOOKING_HERO_OVERLAY_ICON_COLOR = "#ffffff";
export const BOOKING_HERO_OVERLAY_BTN_BG = "rgba(0,0,0,0.55)";
export const BOOKING_HERO_OVERLAY_BTN_BORDER = "rgba(255,255,255,0.32)";

export const bookingFlowPlacePanelStaticStyles = StyleSheet.create({
  wrap: {
    marginBottom: 0,
  },
  wrapFill: {
    flex: 1,
    marginBottom: 0,
  },
  heroWrap: {
    width: "100%",
    overflow: "hidden",
  },
  hero: {
    width: "100%",
    height: "100%",
  },
  heroChrome: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 6,
    paddingHorizontal: 16,
    gap: 8,
  },
  heroProgressWrap: {},
  heroBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BOOKING_HERO_OVERLAY_BTN_BG,
    borderWidth: 1,
    borderColor: BOOKING_HERO_OVERLAY_BTN_BORDER,
  },
  heroBarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: BOOKING_HERO_OVERLAY_BTN_BG,
    borderWidth: 1,
    borderColor: BOOKING_HERO_OVERLAY_BTN_BORDER,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  detailsCard: {
    marginTop: -24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  detailsCardFill: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
  },
  ratingRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  rating: {
    fontSize: 14,
    fontWeight: "600",
  },
  address: {
    marginTop: 10,
  },
  childrenWrap: {
    marginTop: 14,
  },
});

export function bookingFlowPlacePanelThemeStyles(
  colors: ThemeColors,
  useMonotoneDarkBackground: boolean,
) {
  return {
    heroWrap: {
      height: BOOKING_FLOW_HERO_HEIGHT,
      backgroundColor: colors.border,
    },
    detailsCard: {
      borderWidth: useMonotoneDarkBackground ? 0 : 1,
      borderColor: useMonotoneDarkBackground ? colors.background : colors.border,
      backgroundColor: useMonotoneDarkBackground ? colors.background : colors.card,
    },
    title: { color: colors.text },
    rating: { color: colors.textMuted },
    address: { color: colors.text },
  } satisfies Partial<Record<keyof typeof bookingFlowPlacePanelStaticStyles, object>>;
}

export function useBookingFlowPlacePanelStyles(useMonotoneDarkBackground: boolean) {
  const themed = useThemeStyles(
    ({ colors }) => bookingFlowPlacePanelThemeStyles(colors, useMonotoneDarkBackground),
    [useMonotoneDarkBackground],
  );
  return useMemo(() => mergeStaticAndThemed(bookingFlowPlacePanelStaticStyles, themed), [themed]);
}
