import { useMemo } from "react";
import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";

const HERO_HEIGHT = 260;

export const bookingFlowPlacePanelStaticStyles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
  },
  heroWrap: {
    height: HERO_HEIGHT,
    overflow: "hidden",
    alignSelf: "center",
  },
  hero: {
    width: "100%",
    height: "100%",
  },
  heroBar: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 18,
    color: "#111",
    fontWeight: "700",
  },
  dotsRow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 10,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  dotActive: {
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  detailsCard: {
    marginTop: -24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
  },
  rating: {
    marginTop: 6,
    fontSize: 14,
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
  heroWidth: number,
  heroTopInset: number,
  useMonotoneDarkBackground: boolean,
) {
  return {
    heroWrap: {
      width: heroWidth,
      backgroundColor: colors.border,
    },
    heroBar: {
      top: heroTopInset,
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

export function useBookingFlowPlacePanelStyles(
  heroWidth: number,
  heroTopInset: number,
  useMonotoneDarkBackground: boolean,
) {
  const themed = useThemeStyles(
    ({ colors }) =>
      bookingFlowPlacePanelThemeStyles(colors, heroWidth, heroTopInset, useMonotoneDarkBackground),
    [heroWidth, heroTopInset, useMonotoneDarkBackground],
  );
  return useMemo(() => mergeStaticAndThemed(bookingFlowPlacePanelStaticStyles, themed), [themed]);
}
