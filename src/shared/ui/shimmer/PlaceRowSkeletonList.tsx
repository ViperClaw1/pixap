import { memo } from "react";
import { StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { ShimmerSurface } from "./ShimmerSurface";

const DEFAULT_COUNT = 8;

type Variant = "search" | "category";

const THUMB: Record<Variant, { size: number; radius: number }> = {
  search: { size: 56, radius: 8 },
  category: { size: 80, radius: 8 },
};

type Props = {
  variant: Variant;
  count?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

function PlaceRowSkeletonListInner({ variant, count = DEFAULT_COUNT, contentContainerStyle }: Props) {
  const { colors } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const thumb = THUMB[variant];

  const horizontalPad = variant === "search" ? 32 : 32;
  const rowInnerPad = variant === "category" ? 16 : 0;
  const bodyWidth = Math.max(
    80,
    windowWidth - horizontalPad - rowInnerPad - thumb.size - 12,
  );

  return (
    <View style={contentContainerStyle}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={
            variant === "search"
              ? [styles.searchRow, { borderBottomColor: colors.border }]
              : [
                  styles.categoryRow,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]
          }
        >
          <ShimmerSurface width={thumb.size} height={thumb.size} borderRadius={thumb.radius} />
          <View style={styles.body}>
            <ShimmerSurface width={bodyWidth} height={variant === "category" ? 16 : 14} borderRadius={4} />
            <ShimmerSurface
              width={Math.min(bodyWidth, 200)}
              height={12}
              borderRadius={4}
              style={styles.lineGap}
            />
            <View style={styles.tagRow}>
              <ShimmerSurface width={56} height={22} borderRadius={999} />
              <ShimmerSurface width={72} height={22} borderRadius={999} />
              {variant === "category" ? <ShimmerSurface width={64} height={22} borderRadius={999} /> : null}
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

export const PlaceRowSkeletonList = memo(PlaceRowSkeletonListInner);

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  categoryRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
    borderRadius: 12,
    padding: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  body: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  lineGap: { marginTop: 6 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
});
