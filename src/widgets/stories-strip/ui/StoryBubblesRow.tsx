import { memo, useCallback, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import type { StoryGroup } from "@/shared/model/types/stories";
import { StoryBubble } from "./StoryBubble";

interface StoryBubblesRowProps {
  groups: StoryGroup[];
  seenStoryIds: Record<string, true>;
  onPressGroup: (groupIndex: number) => void;
  onPressAddStory?: () => void;
  uploadingAddStory?: boolean;
  loading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

function StoryBubblesRowComponent({
  groups,
  seenStoryIds,
  onPressGroup,
  onPressAddStory,
  uploadingAddStory = false,
  loading = false,
  isError = false,
  onRetry,
}: StoryBubblesRowProps) {
  const { t } = useTranslation();
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
      <View style={[styles.row, !loading && groups.length === 0 && styles.rowEmpty]}>
        <StoryBubble
          group={{
            user_id: "add-story",
            profile: { id: "add-story", first_name: "Add", last_name: "Story", avatar_url: null, username: null },
            stories: [],
          }}
          viewed={false}
          variant="add"
          uploading={uploadingAddStory}
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
          <FlashList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={groups}
            keyExtractor={(item) => item.user_id}
            renderItem={renderItem}
            estimatedItemSize={72}
            contentContainerStyle={styles.listContent}
            initialNumToRender={6}
            maxToRenderPerBatch={8}
            windowSize={5}
            removeClippedSubviews
          />
        ) : (
          <View style={styles.emptyTextWrap}>
            <Text style={[styles.emptyTitle, { color: colors.text }]} numberOfLines={1}>
              {isError
                ? t("placeDetail.storiesLoadError", { defaultValue: "Could not load stories" })
                : t("placeDetail.storiesEmptyTitle", { defaultValue: "No stories yet" })}
            </Text>
            <Text style={[styles.emptyMeta, { color: colors.textMuted }]} numberOfLines={2}>
              {isError
                ? t("placeDetail.storiesLoadErrorHint", {
                    defaultValue: "Check your connection and try again.",
                  })
                : t("placeDetail.storiesEmptyMessage", {
                    defaultValue: "Be the first to capture the vibe here",
                  })}
            </Text>
            {isError && onRetry ? (
              <Pressable onPress={onRetry} hitSlop={8} style={styles.retryBtn}>
                <Text style={[styles.retryText, { color: colors.primary }]}>
                  {t("bookingCommon.retry", { defaultValue: "Retry" })}
                </Text>
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
  rowEmpty: {
    alignItems: "center",
  },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 78,
    gap: 10,
    marginLeft: 10,
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
  emptyTextWrap: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    paddingLeft: 4,
    paddingRight: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  emptyMeta: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
  },
  retryBtn: {
    alignSelf: "flex-start",
    marginTop: 6,
  },
  retryText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
