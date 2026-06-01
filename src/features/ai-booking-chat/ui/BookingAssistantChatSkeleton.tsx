import { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useStaticWindowSize } from "@/shared/lib/useStaticWindowSize";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { ShimmerProvider, ShimmerSurface } from "@/shared/ui/shimmer";

function BookingAssistantChatSkeletonInner() {
  const { colors } = useAppTheme();
  const { width: windowWidth } = useStaticWindowSize();
  const innerWidth = Math.max(240, windowWidth - 32 - 20);

  const bubbles = useMemo(
    () => [
      { align: "flex-start" as const, width: Math.round(innerWidth * 0.88), height: 72 },
      { align: "flex-end" as const, width: Math.round(innerWidth * 0.42), height: 40 },
      { align: "flex-start" as const, width: Math.round(innerWidth * 0.62), height: 40 },
    ],
    [innerWidth],
  );

  return (
    <ShimmerProvider active>
      <View
        style={[
          styles.card,
          {
            borderColor: colors.border,
            backgroundColor: colors.card,
          },
        ]}
      >
        <View style={styles.messages}>
          {bubbles.map((bubble, index) => (
            <View key={`chat-skeleton-bubble-${index}`} style={[styles.bubbleRow, { alignItems: bubble.align }]}>
              <ShimmerSurface width={bubble.width} height={bubble.height} borderRadius={14} />
            </View>
          ))}
        </View>
        <ShimmerSurface width={Math.round(innerWidth * 0.46)} height={36} borderRadius={10} />
        <ShimmerSurface
          width={innerWidth}
          height={44}
          borderRadius={22}
          style={styles.composer}
        />
      </View>
    </ShimmerProvider>
  );
}

export const BookingAssistantChatSkeleton = memo(BookingAssistantChatSkeletonInner);

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
  },
  messages: {
    paddingVertical: 8,
    gap: 10,
  },
  bubbleRow: {
    width: "100%",
  },
  composer: {
    marginTop: 8,
  },
});
