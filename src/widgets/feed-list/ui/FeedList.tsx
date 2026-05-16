import { memo, useCallback } from "react";
import { ActivityIndicator, Dimensions, RefreshControl, StyleSheet, Text, View } from "react-native";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { FLASH_LIST_ESTIMATED_SIZE } from "@/shared/lib/flashListEstimatedSizes";
import type { StoryReactionType } from "@/shared/model/types/stories";
import type { FeedStoryItem } from "@/entities/story";
import { ShimmerProvider } from "@/shared/ui/shimmer/ShimmerProvider";
import { ShimmerSurface } from "@/shared/ui/shimmer/ShimmerSurface";
import { FeedStoryCard } from "./FeedStoryCard";

interface FeedListProps {
  stories: FeedStoryItem[];
  loading: boolean;
  refreshing: boolean;
  hasMore: boolean;
  followPending: boolean;
  currentUserId: string | null;
  onRefresh: () => void;
  onLoadMore: () => void;
  onPressStory: (story: FeedStoryItem) => void;
  onPressComments: (story: FeedStoryItem) => void;
  onPressUser: (story: FeedStoryItem) => void;
  onToggleFollow: (story: FeedStoryItem) => Promise<void>;
  onReact: (story: FeedStoryItem, type: StoryReactionType) => Promise<void>;
  onAuthRequired: () => void;
}

function FeedListComponent({
  stories,
  loading,
  refreshing,
  hasMore,
  followPending,
  currentUserId,
  onRefresh,
  onLoadMore,
  onPressStory,
  onPressComments,
  onPressUser,
  onToggleFollow,
  onReact,
  onAuthRequired,
}: FeedListProps) {
  const { colors } = useAppTheme();
  const skeletonMediaWidth = Dimensions.get("window").width - 48;

  const renderStoryItem = useCallback<ListRenderItem<FeedStoryItem>>(
    ({ item }) => (
      <FeedStoryCard
        story={item}
        canFollow={item.user_id !== currentUserId}
        followPending={followPending}
        onPressStory={() => onPressStory(item)}
        onPressComments={() => onPressComments(item)}
        onPressUser={() => onPressUser(item)}
        onToggleFollow={() => onToggleFollow(item)}
        onReact={(type) => onReact(item, type)}
        onAuthRequired={onAuthRequired}
      />
    ),
    [
      currentUserId,
      followPending,
      onAuthRequired,
      onPressComments,
      onPressStory,
      onPressUser,
      onReact,
      onToggleFollow,
    ],
  );

  if (loading && !stories.length) {
    return (
      <ShimmerProvider active>
        <View style={styles.skeletonWrap}>
          {Array.from({ length: 4 }).map((_, idx) => (
            <View
              key={`feed-skeleton-${idx}`}
              style={[styles.skeletonCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={styles.skeletonHeader}>
                <ShimmerSurface width={44} height={44} borderRadius={22} />
                <View style={styles.skeletonHeaderText}>
                  <ShimmerSurface width={124} height={12} borderRadius={6} />
                  <ShimmerSurface width={88} height={10} borderRadius={5} style={styles.skeletonMetaGap} />
                </View>
              </View>
              <ShimmerSurface width={skeletonMediaWidth} height={220} borderRadius={12} style={styles.skeletonMedia} />
              <View style={styles.skeletonActions}>
                <ShimmerSurface width={56} height={18} borderRadius={9} />
                <ShimmerSurface width={56} height={18} borderRadius={9} />
                <ShimmerSurface width={56} height={18} borderRadius={9} />
              </View>
            </View>
          ))}
        </View>
      </ShimmerProvider>
    );
  }

  return (
    <FlashList
      data={stories}
      keyExtractor={(item) => item.id}
      estimatedItemSize={FLASH_LIST_ESTIMATED_SIZE.feedPost}
      contentContainerStyle={styles.content}
      renderItem={renderStoryItem}
      ItemSeparatorComponent={ListSeparator}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      onEndReachedThreshold={0.35}
      onEndReached={() => {
        if (hasMore && !loading) onLoadMore();
      }}
      ListEmptyComponent={
        <View style={styles.emptyWrap}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No stories in your feed yet.</Text>
        </View>
      }
      ListFooterComponent={
        hasMore && stories.length ? (
          <View style={styles.footer}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null
      }
      initialNumToRender={6}
      maxToRenderPerBatch={8}
      windowSize={7}
      removeClippedSubviews
      showsVerticalScrollIndicator={false}
    />
  );
}

export const FeedList = memo(FeedListComponent);

function ListSeparator() {
  return <View style={styles.itemSeparator} />;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 0,
  },
  itemSeparator: {
    height: 10,
  },
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 36,
  },
  emptyText: {
    fontSize: 14,
  },
  footer: {
    paddingVertical: 12,
  },
  skeletonWrap: {
    padding: 12,
    gap: 10,
  },
  skeletonCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  skeletonHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  skeletonHeaderText: {
    flex: 1,
  },
  skeletonMetaGap: {
    marginTop: 7,
  },
  skeletonMedia: {
    marginTop: 12,
  },
  skeletonActions: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
  },
});
