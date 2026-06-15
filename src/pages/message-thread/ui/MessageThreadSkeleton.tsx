import { useStaticWindowSize } from "@/shared/lib/useStaticWindowSize";
import { messageThreadHeaderHeight } from "@/shared/lib/messageThreadLayout";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ShimmerProvider, ShimmerSurface } from "@/shared/ui/shimmer";
import type { MessageThreadStyles } from "@/shared/theme/messageThreadStyles";

const SKELETON_WIDTH_RATIOS = [0.62, 0.48, 0.7, 0.55, 0.4, 0.58] as const;
const SKELETON_BUBBLE_HEIGHT = 44;
const SKELETON_LIST_GAP = 12;
const SKELETON_LIST_PADDING_TOP = 12;
const SKELETON_MIN_COUNT = 8;
const SKELETON_MAX_COUNT = 16;

function computeSkeletonBubbleCount(
  windowHeight: number,
  headerHeight: number,
  bottomInset: number,
): number {
  const available = windowHeight - headerHeight - bottomInset - SKELETON_LIST_PADDING_TOP;
  const slotHeight = SKELETON_BUBBLE_HEIGHT + SKELETON_LIST_GAP;
  const count = Math.floor(available / slotHeight);
  return Math.min(SKELETON_MAX_COUNT, Math.max(SKELETON_MIN_COUNT, count));
}

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
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useStaticWindowSize();
  const headerHeight = messageThreadHeaderHeight(insets.top);
  const bubbleCount = useMemo(
    () => computeSkeletonBubbleCount(windowHeight, headerHeight, bottomInset),
    [bottomInset, headerHeight, windowHeight],
  );

  const bubbles = useMemo(
    () =>
      Array.from({ length: bubbleCount }, (_, index) => ({
        align: (index % 2 === 0 ? "flex-start" : "flex-end") as "flex-start" | "flex-end",
        width: Math.round(
          windowWidth * SKELETON_WIDTH_RATIOS[index % SKELETON_WIDTH_RATIOS.length] * 0.85,
        ),
      })),
    [bubbleCount, windowWidth],
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
            style={[skeletonStyles.bubbleRow, { alignItems: bubble.align }]}
          >
            <ShimmerSurface width={bubble.width} height={SKELETON_BUBBLE_HEIGHT} borderRadius={16} />
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
    gap: SKELETON_LIST_GAP,
  },
  bubbleRow: {
    width: "100%",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
});
