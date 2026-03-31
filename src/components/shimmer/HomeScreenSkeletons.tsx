import { memo } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { useAppTheme } from "@/contexts/ThemeContext";
import { ShimmerSurface } from "./ShimmerSurface";

/** Must match `BusinessPlaceCard` layout. */
const IMAGE_HORIZONTAL = 96;
const IMAGE_VERTICAL_W = 200;
const IMAGE_VERTICAL_H = 140;
const H_GAP = 12;
const H_PADDING = 12;

const CATEGORY_PILL_W = 88;
const CATEGORY_PILL_H = 40;
const CATEGORY_PILL_R = 20;

const DEFAULT_FEATURED_COUNT = 3;
const DEFAULT_RECOMMENDED_COUNT = 3;
const DEFAULT_CATEGORY_PILLS = 6;

type CategoryProps = { pillCount?: number };
type FeaturedProps = { cardCount?: number };
type RecommendedProps = { cardWidth: number; cardCount?: number };

function CategorySkeletonRowInner({ pillCount = DEFAULT_CATEGORY_PILLS }: CategoryProps) {
  const { isDark } = useAppTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hContent}>
      {Array.from({ length: pillCount }).map((_, i) => (
        <View key={i} style={styles.pillWrap}>
          <ShimmerSurface
            width={CATEGORY_PILL_W}
            height={CATEGORY_PILL_H}
            borderRadius={CATEGORY_PILL_R}
            isDark={isDark}
          />
        </View>
      ))}
    </ScrollView>
  );
}

function FeaturedSkeletonRowInner({ cardCount = DEFAULT_FEATURED_COUNT }: FeaturedProps) {
  const { isDark } = useAppTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hContent}>
      {Array.from({ length: cardCount }).map((_, i) => (
        <View key={i} style={styles.featuredWrap}>
          <ShimmerSurface width={IMAGE_VERTICAL_W} height={IMAGE_VERTICAL_H} borderRadius={12} isDark={isDark} />
          <View style={styles.featuredMeta}>
            <ShimmerSurface width={170} height={14} borderRadius={4} isDark={isDark} />
            <ShimmerSurface width={130} height={12} borderRadius={4} isDark={isDark} style={styles.metaGap} />
            <ShimmerSurface width={90} height={12} borderRadius={4} isDark={isDark} style={styles.metaGap} />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function RecommendedSkeletonListInner({ cardWidth, cardCount = DEFAULT_RECOMMENDED_COUNT }: RecommendedProps) {
  const { colors, isDark } = useAppTheme();
  const innerBodyW = Math.max(80, cardWidth - H_PADDING * 2 - IMAGE_HORIZONTAL - H_GAP);

  return (
    <View>
      {Array.from({ length: cardCount }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.recRow,
            {
              width: cardWidth,
              marginBottom: 12,
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <ShimmerSurface width={IMAGE_HORIZONTAL} height={IMAGE_HORIZONTAL} borderRadius={12} isDark={isDark} />
          <View style={styles.recBody}>
            <View>
              <ShimmerSurface width={innerBodyW} height={16} borderRadius={4} isDark={isDark} />
              <ShimmerSurface
                width={Math.min(innerBodyW, 220)}
                height={12}
                borderRadius={4}
                isDark={isDark}
                style={styles.addrGap}
              />
            </View>
            <View style={styles.tagRow}>
              <ShimmerSurface width={56} height={22} borderRadius={999} isDark={isDark} />
              <ShimmerSurface width={72} height={22} borderRadius={999} isDark={isDark} />
              <ShimmerSurface width={64} height={22} borderRadius={999} isDark={isDark} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

export const CategorySkeletonRow = memo(CategorySkeletonRowInner);
export const FeaturedSkeletonRow = memo(FeaturedSkeletonRowInner);
export const RecommendedSkeletonList = memo(RecommendedSkeletonListInner);

const styles = StyleSheet.create({
  hContent: { paddingRight: 8 },
  pillWrap: { marginRight: 8 },
  featuredWrap: { width: IMAGE_VERTICAL_W, marginRight: 12 },
  featuredMeta: { marginTop: 8, paddingHorizontal: 2 },
  metaGap: { marginTop: 6 },
  recRow: {
    flexDirection: "row",
    gap: H_GAP,
    padding: H_PADDING,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  recBody: {
    flex: 1,
    minWidth: 0,
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  addrGap: { marginTop: 4 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
});
