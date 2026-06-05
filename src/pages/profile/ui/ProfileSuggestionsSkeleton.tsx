import { ScrollView, View } from "react-native";
import { ShimmerProvider, ShimmerSurface } from "@/shared/ui/shimmer";
import { useProfileStyles } from "./profileStyles";

const SKELETON_CARD_COUNT = 3;

export function ProfileSuggestionsSkeleton() {
  const styles = useProfileStyles();

  return (
    <ShimmerProvider>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionScrollContent}>
        {Array.from({ length: SKELETON_CARD_COUNT }, (_, index) => (
          <View key={`suggestion-skeleton-${index}`} style={styles.suggestionCard}>
            <ShimmerSurface width={66} height={66} borderRadius={33} style={styles.suggestionSkeletonAvatar} />
            <ShimmerSurface width={120} height={14} borderRadius={7} style={styles.suggestionSkeletonName} />
            <ShimmerSurface width={96} height={12} borderRadius={6} style={styles.suggestionSkeletonReason} />
            <ShimmerSurface width={144} height={38} borderRadius={10} style={styles.suggestionSkeletonButton} />
          </View>
        ))}
      </ScrollView>
    </ShimmerProvider>
  );
}
