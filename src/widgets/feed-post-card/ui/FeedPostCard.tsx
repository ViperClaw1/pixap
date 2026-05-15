import { memo, useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View, type TextLayoutEvent } from "react-native";
import { FontAwesome6, Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { formatRelativeTime } from "@/shared/lib/formatRelativeTime";
import { profileName } from "@/pages/stories-feed/lib/feedPostHelpers";
import { PostMediaCarousel } from "@/widgets/feed-post-carousel";
import type { FeedPostVm } from "@/pages/stories-feed/lib/feedPostHelpers";

interface FeedPostCardProps {
  vm: FeedPostVm;
  width: number;
  sliderHeight: number;
  isContentExpanded: boolean;
  isLiked: boolean;
  likeCount: number;
  currentUserId: string | null | undefined;
  isFollowing: boolean;
  followPending: boolean;
  onPress: () => void;
  onLike: () => void;
  onOpenComments: () => void;
  onBookNow: () => void;
  onShare: () => void;
  onToggleContent: () => void;
  onToggleFollow: () => void;
}

export const FeedPostCard = memo(function FeedPostCard({
  vm,
  width,
  sliderHeight,
  isContentExpanded,
  isLiked,
  likeCount,
  currentUserId,
  isFollowing,
  followPending,
  onPress,
  onLike,
  onOpenComments,
  onBookNow,
  onShare,
  onToggleContent,
  onToggleFollow,
}: FeedPostCardProps) {
  const { colors } = useAppTheme();
  const item = vm.post;
  const [showMoreLink, setShowMoreLink] = useState(false);
  const postContent = item.content?.trim() ?? "";

  useEffect(() => {
    setShowMoreLink(false);
  }, [item.id, postContent, isContentExpanded]);

  const onMeasurePostTextLayout = useCallback(
    (event: TextLayoutEvent) => {
      if (!isContentExpanded) {
        setShowMoreLink(event.nativeEvent.lines.length > 1);
      }
    },
    [isContentExpanded],
  );

  return (
    <View style={[styles.content, { backgroundColor: colors.background }]}>
      <Pressable onPress={onPress}>
        {vm.postImages.length > 1 ? (
          <PostMediaCarousel
            postId={item.id}
            postImages={vm.postImages}
            postImagesRaw={vm.postImagesRaw}
            postSlideBlurhashes={vm.postSlideBlurhashes}
            width={width}
            sliderHeight={sliderHeight}
          />
        ) : vm.postImages[0] ? (
          <SmartImage
            uri={vm.postImages[0]}
            fallbackUri={vm.postImagesRaw[0] ?? null}
            blurhash={vm.postSlideBlurhashes[0] ?? undefined}
            recyclingKey={`${item.id}-feed-slider-single`}
            style={[styles.sliderImage, { height: sliderHeight }]}
            contentFit="cover"
            transition={85}
          />
        ) : (
          <View style={[styles.sliderFallback, { height: sliderHeight, backgroundColor: colors.card }]}>
            <Ionicons name="image-outline" size={30} color={colors.textMuted} />
          </View>
        )}
      </Pressable>

      <View style={styles.actionsSection}>
        <View style={styles.leftActions}>
          <Pressable style={styles.actionBtn} onPress={onLike}>
            <Ionicons name={isLiked ? "heart" : "heart-outline"} size={24} color={colors.text} />
            <Text style={[styles.actionCount, { color: colors.text }]}>{likeCount}</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={onOpenComments}>
            <Ionicons name="chatbubble-outline" size={23} color={colors.text} />
            <Text style={[styles.actionCount, { color: colors.text }]}>{item.comment_count}</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={onShare}>
            <FontAwesome6 name="share" size={20} color={colors.text} />
          </Pressable>
          {item.place_id ? (
            <Pressable style={[styles.bookBtn, { backgroundColor: BRAND }]} onPress={onBookNow}>
              <Ionicons name="calendar-outline" size={14} color="#fff" />
              <Text style={[styles.bookBtnText, { color: "#fff" }]}>Book</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.commentsSection}>
        {postContent ? (
          <View style={styles.postTextBlock}>
            {!isContentExpanded ? (
              <Text
                pointerEvents="none"
                style={[styles.storyText, styles.hiddenMeasureText, { color: colors.text }]}
                onTextLayout={onMeasurePostTextLayout}
              >
                {postContent}
              </Text>
            ) : null}
            {isContentExpanded ? (
              <Text style={[styles.storyText, { color: colors.text }]}>{postContent}</Text>
            ) : (
              <View style={styles.postTextRow}>
                <Text
                  style={[styles.storyText, styles.postTextFlex, { color: colors.text }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {postContent}
                </Text>
                {showMoreLink ? (
                  <Pressable onPress={onToggleContent} hitSlop={8} accessibilityRole="button">
                    <Text style={[styles.moreLink, { color: colors.textMuted }]}>more...</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </View>
        ) : null}
        <Text style={[styles.publishedAtText, { color: colors.textMuted }]}>{formatRelativeTime(item.created_at)}</Text>
        {item.comment_preview.slice(0, 2).map((comment) => (
          <Text key={comment.id} style={[styles.commentText, { color: colors.text }]} numberOfLines={1}>
            {comment.content}
          </Text>
        ))}
      </View>

      <View style={[styles.authorSection, { borderTopColor: colors.border }]}>
        <View style={styles.authorInfo}>
          {vm.authorAvatar ? (
            <SmartImage
              uri={vm.authorAvatar}
              fallbackUri={vm.authorAvatarRaw}
              style={styles.avatarImage}
              contentFit="cover"
              skipBundledPlaceholder
            />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.card }]}>
              <Ionicons name="person-outline" size={18} color={colors.text} />
            </View>
          )}
          <View style={styles.authorNameRow}>
            <Text style={[styles.authorName, { color: colors.text }]}>
              {profileName(item.profile?.first_name, item.profile?.last_name)}
            </Text>
            {item.profile?.is_verified ? (
              <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
            ) : null}
          </View>
        </View>
        {item.user_id !== currentUserId ? (
          <Pressable
            style={[
              styles.followBtn,
              {
                borderColor: isFollowing ? colors.accent : colors.border,
                backgroundColor: isFollowing ? colors.accentSurface : colors.background,
              },
            ]}
            onPress={onToggleFollow}
            disabled={followPending}
          >
            <Text style={[styles.followText, { color: isFollowing ? colors.accent : colors.text }]}>
              {isFollowing ? "Following" : "Follow"}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  content: { paddingBottom: 8 },
  sliderImage: { width: "100%" },
  sliderFallback: { width: "100%", alignItems: "center", justifyContent: "center" },
  actionsSection: { paddingHorizontal: 14, paddingTop: 10 },
  leftActions: { flexDirection: "row", alignItems: "center", gap: 16 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  bookBtn: { minHeight: 34, paddingHorizontal: 14, borderRadius: 14, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" },
  bookBtnText: { fontSize: 13, fontWeight: "700", lineHeight: 16 },
  actionCount: { fontSize: 16, fontWeight: "700" },
  commentsSection: { paddingHorizontal: 14, paddingTop: 8, gap: 6 },
  postTextBlock: { position: "relative" },
  postTextRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  postTextFlex: { flex: 1, minWidth: 0 },
  hiddenMeasureText: { position: "absolute", opacity: 0, left: 0, right: 0, zIndex: -1 },
  storyText: { fontSize: 16, lineHeight: 22, fontWeight: "500" },
  moreLink: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
  publishedAtText: { fontSize: 12, lineHeight: 16 },
  commentText: { fontSize: 14, lineHeight: 19 },
  authorSection: { marginTop: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  authorInfo: { flexDirection: "row", alignItems: "center", gap: 10 },
  authorNameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  avatarPlaceholder: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  avatarImage: { width: 36, height: 36, borderRadius: 18 },
  authorName: { fontSize: 15, fontWeight: "700" },
  followBtn: { minWidth: 86, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, alignItems: "center" },
  followText: { fontSize: 14, fontWeight: "700" },
});
