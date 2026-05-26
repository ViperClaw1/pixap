import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, type TextLayoutEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { FontAwesome6, Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { AnimatedLikeHeart } from "@/shared/ui/animated-like-heart";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { StoryMediaSlide } from "@/widgets/stories-strip";
import { formatRelativeTime } from "@/shared/lib/formatRelativeTime";
import { profileName } from "@/pages/stories-feed/lib/feedPostHelpers";
import { PostMediaCarousel } from "@/widgets/feed-post-carousel";
import { CommentPreview } from "@/widgets/feed-list";
import { PostBoostCrownBadge, PostBoostStarButton } from "@/features/post-boost";
import type { FeedPostVm } from "@/pages/stories-feed/lib/feedPostHelpers";

const FEED_MEDIA_DOUBLE_TAP_MAX_MS = 280;

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
  canBoost?: boolean;
  isBoosted?: boolean;
  boostPending?: boolean;
  onBoost?: () => void;
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
  canBoost = false,
  isBoosted = false,
  boostPending = false,
  onBoost,
}: FeedPostCardProps) {
  const { colors } = useAppTheme();
  const item = vm.post;
  const [showMoreLink, setShowMoreLink] = useState(false);
  const postContent = item.content?.trim() ?? "";
  const geoFormattedAddress = item.geo_formatted_address?.trim() ?? "";

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

  const carouselDoubleTapGesture = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .maxDuration(FEED_MEDIA_DOUBLE_TAP_MAX_MS)
        .onEnd(() => {
          runOnJS(onPress)();
        }),
    [onPress],
  );

  const hasCarousel = vm.postImages.length > 1;

  return (
    <View style={[styles.content, { backgroundColor: colors.background }]}>
      <View style={[styles.authorSection, { borderBottomColor: colors.border }]}>
        <View style={styles.authorMain}>
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
          <View style={styles.authorMeta}>
            <View style={styles.authorNameRow}>
              <Text style={[styles.authorName, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
                {profileName(item.profile?.first_name, item.profile?.last_name)}
              </Text>
              {item.profile?.is_verified ? (
                <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
              ) : null}
            </View>
            {geoFormattedAddress ? (
              <View style={styles.authorGeoRow}>
                <Ionicons name="location-outline" size={14} color={colors.textMuted} style={styles.authorGeoIcon} />
                <Text style={[styles.authorGeo, { color: colors.textMuted }]}>{geoFormattedAddress}</Text>
              </View>
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

      <View style={[styles.mediaFrame, { height: sliderHeight }]}>
        {hasCarousel ? (
          <GestureDetector gesture={carouselDoubleTapGesture}>
            <View style={styles.mediaPressable}>
              <PostMediaCarousel
                postId={item.id}
                postImages={vm.postImages}
                postImagesRaw={vm.postImagesRaw}
                postSlideBlurhashes={vm.postSlideBlurhashes}
                width={width}
                sliderHeight={sliderHeight}
              />
            </View>
          </GestureDetector>
        ) : (
          <Pressable style={styles.mediaPressable} onPress={onPress}>
            <StoryMediaSlide
              optimizedUri={vm.postImages[0] ?? null}
              fallbackUri={vm.postImagesRaw[0] ?? null}
              blurhash={vm.postSlideBlurhashes[0] ?? null}
              recyclingKey={`${item.id}-feed-slider-single`}
              width={width}
              height={sliderHeight}
            />
          </Pressable>
        )}
        {isBoosted ? <PostBoostCrownBadge /> : null}
      </View>

      <View style={styles.actionsSection}>
        <View style={styles.actionsRow}>
          <View style={styles.leftActions}>
            <Pressable style={styles.actionBtn} onPress={onLike}>
              <AnimatedLikeHeart liked={isLiked} size={24} color={colors.text} likedColor={colors.text} />
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
              <Pressable style={[styles.bookBtn, { backgroundColor: colors.accent }]} onPress={onBookNow}>
                <Ionicons name="calendar-outline" size={14} color={colors.onAccent} />
                <Text style={[styles.bookBtnText, { color: colors.onAccent }]}>Book</Text>
              </Pressable>
            ) : null}
          </View>
          {canBoost && onBoost ? (
            <PostBoostStarButton active={isBoosted} disabled={boostPending} onPress={onBoost} />
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
        {item.comment_preview.length > 0 ? (
          <CommentPreview
            comments={item.comment_preview.slice(0, 2)}
            commentCount={item.comment_count}
            onPressComments={onOpenComments}
            showFooterLink={false}
          />
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  content: { paddingBottom: 8 },
  mediaFrame: { position: "relative", width: "100%" },
  mediaPressable: { flex: 1 },
  actionsSection: { paddingHorizontal: 14, paddingTop: 10 },
  actionsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  leftActions: { flexDirection: "row", alignItems: "center", gap: 16, flex: 1, flexWrap: "wrap" },
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
  authorSection: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  authorMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    minWidth: 0,
  },
  authorMeta: { flex: 1, minWidth: 0, gap: 4 },
  authorNameRow: { flexDirection: "row", alignItems: "center", gap: 4, minWidth: 0 },
  authorGeoRow: { flexDirection: "row", alignItems: "flex-start", gap: 4, marginTop: 2 },
  authorGeoIcon: { marginTop: 1 },
  authorGeo: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
  },
  avatarPlaceholder: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  avatarImage: { width: 36, height: 36, borderRadius: 18 },
  authorName: { flexShrink: 1, fontSize: 15, fontWeight: "700" },
  followBtn: {
    flexShrink: 0,
    minWidth: 86,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
  },
  followText: { fontSize: 14, fontWeight: "700" },
});
