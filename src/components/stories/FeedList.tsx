import { memo } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "@/contexts/ThemeContext";
import type { StoryReactionType } from "@/types/stories";
import type { FeedStoryItem } from "@/hooks/useStoriesFeed";
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
}: FeedListProps) {
  const { colors } = useAppTheme();

  if (loading && !stories.length) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={stories}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      renderItem={({ item }) => (
        <FeedStoryCard
          story={item}
          canFollow={item.user_id !== currentUserId}
          followPending={followPending}
          onPressStory={() => onPressStory(item)}
          onPressComments={() => onPressComments(item)}
          onPressUser={() => onPressUser(item)}
          onToggleFollow={() => onToggleFollow(item)}
          onReact={(type) => onReact(item, type)}
        />
      )}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
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

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    padding: 12,
    paddingBottom: 22,
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
});
