import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { ShimmerProvider, ShimmerSurface } from "@/shared/ui/shimmer";

export const VIBE_ROUTE_MAP_HEIGHT = 200;

export function VibeRouteMapSkeleton() {
  const { colors } = useAppTheme();
  const [layoutWidth, setLayoutWidth] = useState(0);

  return (
    <View
      style={[styles.wrap, { borderColor: colors.border }]}
      onLayout={(event) => {
        const next = Math.round(event.nativeEvent.layout.width);
        if (next > 0 && next !== layoutWidth) setLayoutWidth(next);
      }}
    >
      {layoutWidth > 0 ? (
        <ShimmerProvider active>
          <ShimmerSurface width={layoutWidth} height={VIBE_ROUTE_MAP_HEIGHT} borderRadius={12} />
        </ShimmerProvider>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: VIBE_ROUTE_MAP_HEIGHT,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
  },
});
