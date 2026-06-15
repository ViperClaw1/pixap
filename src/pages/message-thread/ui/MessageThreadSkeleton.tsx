import { useStaticWindowSize } from "@/shared/lib/useStaticWindowSize";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { ShimmerProvider, ShimmerSurface } from "@/shared/ui/shimmer";
import type { MessageThreadStyles } from "@/shared/theme/messageThreadStyles";

const SKELETON_WIDTH_RATIOS = [0.62, 0.48, 0.7, 0.55, 0.4, 0.58] as const;
const SKELETON_ALIGNS = ["flex-start", "flex-end", "flex-start", "flex-end", "flex-start", "flex-end"] as const;

type Props = {
  styles: MessageThreadStyles;
  backgroundColor?: string;
  bottomInset?: number;
  /** Cover the list area while the real scroll position is prepared underneath. */
  overlay?: boolean;
};

export function MessageThreadSkeleton({
  styles,
  backgroundColor,
  bottomInset = 0,
  overlay = false,
}: Props) {
  const { width: windowWidth } = useStaticWindowSize();
  const bubbles = useMemo(
    () =>
      SKELETON_WIDTH_RATIOS.map((ratio, index) => ({
        align: SKELETON_ALIGNS[index] as "flex-start" | "flex-end",
        width: Math.round(windowWidth * ratio * 0.85),
      })),
    [windowWidth],
  );

  return (
    <ShimmerProvider active>
      <View
        style={[
          styles.list,
          styles.listContent,
          styles.listLoading,
          skeletonStyles.fillHeight,
          overlay && skeletonStyles.overlay,
          overlay && backgroundColor ? { backgroundColor } : null,
          bottomInset > 0 ? { paddingBottom: bottomInset } : null,
        ]}
      >
        {bubbles.map((bubble, index) => (
          <View
            key={`thread-skeleton-${index}`}
            style={{ width: "100%", alignItems: bubble.align }}
          >
            <ShimmerSurface width={bubble.width} height={44} borderRadius={16} />
          </View>
        ))}
      </View>
    </ShimmerProvider>
  );
}

const skeletonStyles = StyleSheet.create({
  fillHeight: {
    flex: 1,
    justifyContent: "space-between",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
});
