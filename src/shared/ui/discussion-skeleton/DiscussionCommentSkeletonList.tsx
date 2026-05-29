import { useStaticWindowSize } from "@/shared/lib/useStaticWindowSize";
import { memo, useMemo } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { ShimmerProvider, ShimmerSurface } from "@/shared/ui/shimmer";

const AVATAR = 32;
const THREAD_INDENT = 42;
const HORIZONTAL_PAD = 16;
const ROW_GAP = 10;
const ACTION_COL = 28;

type CardConfig = {
  variant?: "comment" | "reply";
  bodyLines?: 1 | 2;
};

const SKELETON_CARDS: CardConfig[] = [
  { bodyLines: 2 },
  { bodyLines: 1 },
  { bodyLines: 2 },
  { variant: "reply", bodyLines: 1 },
];

type Props = {
  onLayout?: (width: number, height: number) => void;
};

function DiscussionCommentSkeletonCard({
  midWidth,
  variant = "comment",
  bodyLines = 2,
}: {
  midWidth: number;
  variant?: "comment" | "reply";
  bodyLines?: 1 | 2;
}) {
  const nameWidth = Math.min(midWidth * 0.55, 128);
  const bodyWidth = bodyLines === 1 ? midWidth * 0.78 : midWidth;
  const bodyHeight = bodyLines === 1 ? 17 : 34;

  return (
    <View style={[styles.card, variant === "reply" && styles.replyCard]}>
      <View style={styles.row}>
        <ShimmerSurface width={AVATAR} height={AVATAR} borderRadius={AVATAR / 2} />
        <View style={[styles.mid, { width: midWidth }]}>
          <ShimmerSurface width={nameWidth} height={13} borderRadius={4} />
          <ShimmerSurface width={bodyWidth} height={bodyHeight} borderRadius={4} style={styles.bodyGap} />
          <ShimmerSurface width={42} height={12} borderRadius={4} />
        </View>
        <ShimmerSurface width={13} height={13} borderRadius={7} />
      </View>
    </View>
  );
}

function DiscussionCommentSkeletonListInner({ onLayout }: Props) {
  const { width: windowWidth } = useStaticWindowSize();
  const midWidth = useMemo(
    () => Math.max(120, windowWidth - HORIZONTAL_PAD * 2 - AVATAR - ROW_GAP - ACTION_COL),
    [windowWidth],
  );
  const replyMidWidth = Math.max(96, midWidth - THREAD_INDENT);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    onLayout?.(width, height);
  };

  return (
    <ShimmerProvider active>
      <View style={styles.list} onLayout={handleLayout}>
        <View style={styles.countHeader}>
          <ShimmerSurface width={120} height={17} borderRadius={4} />
          <ShimmerSurface width={92} height={13} borderRadius={4} />
        </View>
        {SKELETON_CARDS.map((card, index) => (
          <DiscussionCommentSkeletonCard
            key={index}
            midWidth={card.variant === "reply" ? replyMidWidth : midWidth}
            variant={card.variant}
            bodyLines={card.bodyLines}
          />
        ))}
      </View>
    </ShimmerProvider>
  );
}

export const DiscussionCommentSkeletonList = memo(DiscussionCommentSkeletonListInner);

const styles = StyleSheet.create({
  list: {
    flexGrow: 1,
    paddingHorizontal: HORIZONTAL_PAD,
    paddingTop: 4,
    paddingBottom: 8,
  },
  countHeader: {
    paddingBottom: 12,
    gap: 6,
  },
  card: {
    paddingBottom: 10,
  },
  replyCard: {
    marginLeft: THREAD_INDENT,
    marginTop: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: ROW_GAP,
  },
  mid: {
    flexShrink: 1,
    gap: 0,
  },
  bodyGap: {
    marginTop: 4,
    marginBottom: 4,
  },
});
