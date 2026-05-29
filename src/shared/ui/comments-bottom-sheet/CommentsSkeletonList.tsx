import { useStaticWindowSize } from "@/shared/lib/useStaticWindowSize";
import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { ShimmerProvider, ShimmerSurface } from "@/shared/ui/shimmer";

const SKELETON_COUNT = 4;
const HORIZONTAL_PAD = 14;

function CommentSkeletonCard({ bodyWidth }: { bodyWidth: number }) {
  return (
    <View style={styles.card}>
      <View style={styles.authorRow}>
        <ShimmerSurface width={26} height={26} borderRadius={13} />
        <ShimmerSurface width={Math.min(bodyWidth * 0.45, 140)} height={14} borderRadius={4} />
      </View>
      <ShimmerSurface width={bodyWidth} height={40} borderRadius={6} />
      <ShimmerSurface width={Math.min(bodyWidth * 0.55, 180)} height={12} borderRadius={4} />
    </View>
  );
}

function CommentsSkeletonListInner() {
  const { width: windowWidth } = useStaticWindowSize();
  const bodyWidth = Math.max(120, windowWidth - HORIZONTAL_PAD * 2);

  return (
    <ShimmerProvider active>
      <View style={styles.list}>
        {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
          <CommentSkeletonCard key={index} bodyWidth={bodyWidth} />
        ))}
      </View>
    </ShimmerProvider>
  );
}

export const CommentsSkeletonList = memo(CommentsSkeletonListInner);

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: HORIZONTAL_PAD,
    paddingVertical: 8,
    gap: 0,
  },
  card: {
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "transparent",
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
