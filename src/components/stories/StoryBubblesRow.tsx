import { memo, useCallback, useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "@/contexts/ThemeContext";
import type { StoryGroup } from "@/types/stories";
import { StoryBubble } from "./StoryBubble";

interface StoryBubblesRowProps {
  groups: StoryGroup[];
  seenStoryIds: Record<string, true>;
  onPressGroup: (groupIndex: number) => void;
  onPressAddStory?: () => void;
  loading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

function StoryBubblesRowComponent({
  groups,
  seenStoryIds,
  onPressGroup,
  onPressAddStory,
  loading = false,
  isError = false,
  onRetry,
}: StoryBubblesRowProps) {
  const { colors } = useAppTheme();

  const titleStyle = useMemo(() => [styles.title, { color: colors.text }], [colors.text]);

  const renderItem = useCallback(
    ({ item, index }: { item: StoryGroup; index: number }) => {
      const viewed = item.stories.every((story) => seenStoryIds[story.id]);
      return <StoryBubble group={item} viewed={viewed} onPress={() => onPressGroup(index)} />;
    },
    [onPressGroup, seenStoryIds],
  );

  return (
    <View style={styles.container}>
      <Text style={titleStyle}>Stories</Text>
      <View style={styles.row}>
        <StoryBubble
          group={{
            user_id: "add-story",
            profile: { id: "add-story", first_name: "Add", last_name: "Story", avatar_url: null },
            stories: [],
          }}
          viewed={false}
          variant="add"
          onPress={() => onPressAddStory?.()}
        />
        {loading ? (
          <View style={styles.skeletonRow}>
            {Array.from({ length: 4 }).map((_, idx) => (
              <View key={`stories-skeleton-${idx}`} style={styles.skeletonWrap}>
                <View style={[styles.skeletonCircle, { backgroundColor: colors.border }]} />
                <View style={[styles.skeletonLine, { backgroundColor: colors.border }]} />
              </View>
            ))}
          </View>
        ) : groups.length > 0 ? (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={groups}
            keyExtractor={(item) => item.user_id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            initialNumToRender={6}
            maxToRenderPerBatch={8}
            windowSize={5}
            removeClippedSubviews
          />
        ) : (
          <View style={styles.emptyWrap}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              {isError ? "Could not load stories." : "Be the first to share your experience"}
            </Text>
            {isError && onRetry ? (
              <Pressable onPress={onRetry}>
                <Text style={[styles.retryText, { color: colors.primary }]}>Retry</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}

export const StoryBubblesRow = memo(StoryBubblesRowComponent);

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
  },
  listContent: {
    paddingRight: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 78,
    gap: 10,
  },
  skeletonWrap: {
    width: 64,
    alignItems: "center",
    gap: 6,
  },
  skeletonCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  skeletonLine: {
    width: 44,
    height: 9,
    borderRadius: 6,
  },
  emptyWrap: {
    minHeight: 78,
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 12,
    fontWeight: "500",
  },
  retryText: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "700",
  },
});
