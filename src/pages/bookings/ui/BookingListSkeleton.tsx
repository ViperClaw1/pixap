import { memo } from "react";
import { View } from "react-native";
import { ShimmerSurface } from "@/shared/ui/shimmer";
import type { bookingsStaticStyles } from "./bookingsStyles";

const BOOKING_THUMB_DISPLAY = 80;
const BOOKING_THUMB_COMPACT = 56;

const SKELETON_CARD_IDS = ["1", "2", "3", "4", "5"] as const;

type BookingsScreenStyles = typeof bookingsStaticStyles;

type Props = {
  styles: BookingsScreenStyles;
  isCompact: boolean;
  contentPaddingBottom: number;
};

function BookingListSkeletonInner({ styles, isCompact, contentPaddingBottom }: Props) {
  const thumbEdge = isCompact ? BOOKING_THUMB_COMPACT : BOOKING_THUMB_DISPLAY;

  return (
    <View style={[styles.skeletonList, { paddingBottom: contentPaddingBottom }]}>
      {SKELETON_CARD_IDS.map((id) => (
        <View key={`booking-skeleton-${id}`} style={styles.skeletonCard}>
          <ShimmerSurface width={thumbEdge} height={thumbEdge} borderRadius={8} />
          <View style={styles.skeletonBody}>
            <View style={styles.skeletonRowHead}>
              <ShimmerSurface width={isCompact ? 120 : 160} height={15} borderRadius={6} />
              <ShimmerSurface width={64} height={24} borderRadius={999} />
            </View>
            <ShimmerSurface width={140} height={12} borderRadius={6} style={styles.skeletonMetaGap} />
            <ShimmerSurface width={96} height={12} borderRadius={6} style={styles.skeletonMetaGap} />
            <ShimmerSurface width={88} height={22} borderRadius={999} style={styles.skeletonBadgeGap} />
          </View>
        </View>
      ))}
    </View>
  );
}

export const BookingListSkeleton = memo(BookingListSkeletonInner);
