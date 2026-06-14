import { StyleSheet, View, useWindowDimensions } from "react-native";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { ShimmerSurface } from "@/shared/ui/shimmer";
import { radii } from "@/shared/theme/radii";
import { DAILY_PICKS_HERO_HEIGHT } from "./DailyPicksHero";

const HORIZONTAL_PADDING = 32;

export function DailyPicksHeroSkeleton() {
  const { width: windowWidth } = useWindowDimensions();
  const { colors } = useAppTheme();
  const cardWidth = Math.max(0, windowWidth - HORIZONTAL_PADDING);

  return (
    <View style={[styles.wrap, { borderColor: colors.border }]}>
      <ShimmerSurface width={cardWidth} height={DAILY_PICKS_HERO_HEIGHT} borderRadius={radii.card} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: DAILY_PICKS_HERO_HEIGHT,
    borderRadius: radii.card,
    overflow: "hidden",
    marginBottom: 14,
    borderWidth: 1,
  },
});
