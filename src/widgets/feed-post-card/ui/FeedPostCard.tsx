import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextLayoutEvent,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { FontAwesome6, Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { AnimatedLikeHeart } from "@/shared/ui/animated-like-heart";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { StoryMediaSlide } from "@/widgets/stories-strip";
import { formatRelativeTime } from "@/shared/lib/formatRelativeTime";
import { profileName } from "@/pages/stories-feed/lib/feedPostHelpers";
import { PostMediaCarousel } from "@/widgets/feed-post-carousel";
import { CommentPreview } from "@/widgets/feed-list";
import { PostBoostCrownBadge, PostBoostStarButton, usePostBoostBadgeVisible } from "@/features/post-boost";
import type { FeedPostVm } from "@/pages/stories-feed/lib/feedPostHelpers";
import { DOUBLE_TAP_DELAY_MS } from "@/pages/stories-feed/model/constants";
import { isAuthRequiredError } from "@/shared/lib/auth/authRequired";
import { useDeletePost, useUpdatePost } from "@/entities/post";
import { AppPopupModal, appAlert } from "@/shared/ui/app-popup";
import { UgcModerationOverflow } from "@/features/ugc-moderation";

interface FeedPostCardProps {
  vm: FeedPostVm;
  width: number;
  sliderHeight: number;
  isContentExpanded: boolean;
  currentUserId: string | null | undefined;
  isFollowing: boolean;
  followPending: boolean;
  onToggleLike: () => void | Promise<void>;
  onOpenComments: () => void;
  onBookNow: () => void;
  onShare: () => void;
  onToggleContent: () => void;
  onToggleFollow: () => void;
  canBoost?: boolean;
  isBoosted?: boolean;
  boostPending?: boolean;
  onBoost?: () => void;
  carouselAutoPlay?: boolean;
  onPostDeleted?: () => void;
  /** Reports title edit input position; parent scrolls once when keyboard is visible. */
  onTitleInputLayout?: (layout: { y: number; height: number }) => void;
}

/** Matches comment / boost icons in the actions row. */
const FEED_ACTION_ICON_SIZE = 23;

export const FeedPostCard = memo(function FeedPostCard({
  vm,
  width,
  sliderHeight,
  isContentExpanded,
  currentUserId,
  isFollowing,
  followPending,
  onToggleLike,
  onOpenComments,
  onBookNow,
  onShare,
  onToggleContent,
  onToggleFollow,
  canBoost = false,
  isBoosted = false,
  boostPending = false,
  onBoost,
  carouselAutoPlay = true,
  onPostDeleted,
  onTitleInputLayout,
}: FeedPostCardProps) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const item = vm.post;
  const updatePostMutation = useUpdatePost();
  const deletePostMutation = useDeletePost();
  const [localLiked, setLocalLiked] = useState(item.my_reaction === "like");
  const [localLikeCount, setLocalLikeCount] = useState(item.reaction_count);
  const lastTapAtRef = useRef(0);
  const [showMoreLink, setShowMoreLink] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const titleInputRef = useRef<TextInput | null>(null);
  const isOwner = Boolean(currentUserId && item.user_id === currentUserId);

  useEffect(() => {
    setLocalLiked(item.my_reaction === "like");
    setLocalLikeCount(item.reaction_count);
  }, [item.id, item.my_reaction, item.reaction_count]);
  const postContent = item.content?.trim() ?? "";
  const geoFormattedAddress = item.geo_formatted_address?.trim() ?? "";

  useEffect(() => {
    setShowMoreLink(false);
  }, [item.id, postContent, isContentExpanded]);

  useEffect(() => {
    setIsEditingTitle(false);
    setTitleDraft("");
    setDeleteConfirmVisible(false);
  }, [item.id]);

  const reportTitleInputLayout = useCallback(() => {
    const input = titleInputRef.current;
    if (!input || typeof input.measureInWindow !== "function") return;
    input.measureInWindow((_x, y, _w, h) => {
      onTitleInputLayout?.({ y, height: h });
    });
  }, [onTitleInputLayout]);

  const startEditTitle = useCallback(() => {
    setTitleDraft(postContent);
    setIsEditingTitle(true);
  }, [postContent]);

  const cancelEditTitle = useCallback(() => {
    setIsEditingTitle(false);
    setTitleDraft("");
  }, []);

  const saveEditedTitle = useCallback(() => {
    const trimmed = titleDraft.trim();
    if (!trimmed) {
      appAlert("Post required", "Post text cannot be empty.", undefined, "alert");
      return;
    }
    if (trimmed === postContent) {
      cancelEditTitle();
      return;
    }
    void updatePostMutation
      .mutateAsync({ postId: item.id, content: trimmed })
      .then(() => {
        cancelEditTitle();
      })
      .catch((error) => {
        if (isAuthRequiredError(error)) return;
        appAlert("Edit failed", error instanceof Error ? error.message : "Please try again.", undefined, "alert");
      });
  }, [cancelEditTitle, item.id, postContent, titleDraft, updatePostMutation]);

  const executeDeletePost = useCallback(() => {
    if (isEditingTitle) {
      cancelEditTitle();
    }
    void deletePostMutation
      .mutateAsync({ postId: item.id })
      .then(() => {
        setDeleteConfirmVisible(false);
        onPostDeleted?.();
      })
      .catch((error) => {
        if (isAuthRequiredError(error)) return;
        appAlert("Delete failed", error instanceof Error ? error.message : "Please try again.", undefined, "alert");
      });
  }, [cancelEditTitle, deletePostMutation, isEditingTitle, item.id, onPostDeleted]);

  const onMeasurePostTextLayout = useCallback(
    (event: TextLayoutEvent) => {
      if (!isContentExpanded) {
        setShowMoreLink(event.nativeEvent.lines.length > 1);
      }
    },
    [isContentExpanded],
  );

  const runToggleLike = useCallback(async () => {
    const wasLiked = localLiked;
    setLocalLiked(!wasLiked);
    setLocalLikeCount((prev) => (wasLiked ? Math.max(0, prev - 1) : prev + 1));
    try {
      await onToggleLike();
    } catch (error) {
      setLocalLiked(wasLiked);
      setLocalLikeCount(item.reaction_count);
      if (!isAuthRequiredError(error)) {
        throw error;
      }
    }
  }, [item.reaction_count, localLiked, onToggleLike]);

  const onMediaPress = useCallback(() => {
    const now = Date.now();
    const lastTapAt = lastTapAtRef.current;
    if (now - lastTapAt <= DOUBLE_TAP_DELAY_MS) {
      lastTapAtRef.current = 0;
      void runToggleLike();
      return;
    }
    lastTapAtRef.current = now;
  }, [runToggleLike]);

  const carouselDoubleTapGesture = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .maxDuration(DOUBLE_TAP_DELAY_MS)
        .onEnd(() => {
          runOnJS(runToggleLike)();
        }),
    [runToggleLike],
  );

  const hasCarousel = vm.postImages.length > 1;
  const showTopBadge = usePostBoostBadgeVisible(item.boosted_at);

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
          <View style={styles.authorContent}>
            <View style={styles.authorMetaHeader}>
              <View style={styles.authorNameRow}>
                <Text style={[styles.authorName, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
                  {profileName(item.profile?.first_name, item.profile?.last_name)}
                </Text>
                {item.profile?.is_verified ? (
                  <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                ) : null}
              </View>
              {showTopBadge ? (
                <View style={styles.authorBadgesRow}>
                  {item.user_id !== currentUserId ? (
                    <Pressable
                      style={[
                        styles.compactBadge,
                        {
                          borderColor: isFollowing ? colors.accent : colors.border,
                          backgroundColor: isFollowing ? colors.accentSurface : colors.background,
                        },
                      ]}
                      onPress={onToggleFollow}
                      disabled={followPending}
                    >
                      <Text style={[styles.compactBadgeText, { color: isFollowing ? colors.accent : colors.text }]}>
                        {isFollowing ? t("feed.following") : t("feed.follow")}
                      </Text>
                    </Pressable>
                  ) : null}
                  <PostBoostCrownBadge />
                </View>
              ) : null}
              {item.user_id !== currentUserId && !showTopBadge ? (
                <View style={styles.authorActionsRow}>
                  <Pressable
                    style={[
                      styles.compactBadge,
                      {
                        borderColor: isFollowing ? colors.accent : colors.border,
                        backgroundColor: isFollowing ? colors.accentSurface : colors.background,
                      },
                    ]}
                    onPress={onToggleFollow}
                    disabled={followPending}
                  >
                    <Text style={[styles.compactBadgeText, { color: isFollowing ? colors.accent : colors.text }]}>
                      {isFollowing ? t("feed.following") : t("feed.follow")}
                    </Text>
                  </Pressable>
                  <UgcModerationOverflow
                    hidden={!item.user_id}
                    subject={{
                      targetType: "post",
                      targetId: item.id,
                      reportedUserId: item.user_id,
                      authorLabel: profileName(item.profile?.first_name, item.profile?.last_name),
                    }}
                  />
                </View>
              ) : item.user_id !== currentUserId ? (
                <UgcModerationOverflow
                  subject={{
                    targetType: "post",
                    targetId: item.id,
                    reportedUserId: item.user_id,
                    authorLabel: profileName(item.profile?.first_name, item.profile?.last_name),
                  }}
                />
              ) : null}
            </View>
            {geoFormattedAddress ? (
              <View style={styles.authorGeoRow}>
                <View style={styles.authorGeoContent}>
                  <Ionicons name="location-outline" size={14} color={colors.textMuted} style={styles.authorGeoIcon} />
                  <Text style={[styles.authorGeo, { color: colors.textMuted }]}>{geoFormattedAddress}</Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>
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
                autoPlay={carouselAutoPlay}
              />
            </View>
          </GestureDetector>
        ) : (
          <Pressable style={styles.mediaPressable} onPress={onMediaPress}>
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
      </View>

      <View style={styles.actionsSection}>
        <View style={styles.actionsRow}>
          <View style={styles.leftActions}>
            <Pressable style={styles.actionBtn} onPress={() => void runToggleLike()}>
              <AnimatedLikeHeart liked={localLiked} size={24} color={colors.text} likedColor={colors.text} />
              <Text style={[styles.actionCount, { color: colors.text }]}>{localLikeCount}</Text>
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
          <View style={styles.rightActions}>
            {isOwner ? (
              <>
                <Pressable
                  style={styles.actionBtn}
                  onPress={startEditTitle}
                  hitSlop={8}
                  accessibilityLabel="Edit post"
                >
                  <Ionicons name="create-outline" size={FEED_ACTION_ICON_SIZE} color={colors.text} />
                </Pressable>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => setDeleteConfirmVisible(true)}
                  hitSlop={8}
                  accessibilityLabel="Delete post"
                >
                  <Ionicons name="trash-outline" size={FEED_ACTION_ICON_SIZE} color={colors.danger} />
                </Pressable>
              </>
            ) : null}
            {canBoost && onBoost ? (
              <PostBoostStarButton
                active={isBoosted}
                disabled={boostPending}
                onPress={onBoost}
                grouped
              />
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.commentsSection}>
        {postContent || isEditingTitle ? (
          <View style={styles.postTextBlock}>
            {isEditingTitle ? (
              <View style={styles.titleEditWrap}>
                <TextInput
                  ref={titleInputRef}
                  value={titleDraft}
                  onChangeText={setTitleDraft}
                  placeholder="Post text..."
                  placeholderTextColor={colors.textMuted}
                  style={[
                    styles.titleEditInput,
                    { backgroundColor: colors.card, color: colors.text, borderColor: colors.border },
                  ]}
                  editable={!updatePostMutation.isPending}
                  multiline
                  autoFocus
                  onFocus={reportTitleInputLayout}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Save post text"
                  style={[
                    styles.titleSaveBtn,
                    { backgroundColor: colors.primary },
                    (!titleDraft.trim() || updatePostMutation.isPending) && styles.titleSaveBtnDisabled,
                  ]}
                  disabled={!titleDraft.trim() || updatePostMutation.isPending}
                  onPress={saveEditedTitle}
                >
                  {updatePostMutation.isPending ? (
                    <ActivityIndicator size="small" color={colors.onPrimary} />
                  ) : (
                    <Ionicons name="checkmark" size={18} color={colors.onPrimary} />
                  )}
                </Pressable>
              </View>
            ) : (
              <>
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
              </>
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

      <Modal
        visible={deleteConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteConfirmVisible(false)}
      >
        <AppPopupModal
          embedded
          visible={deleteConfirmVisible}
          variant="alert"
          title="Delete post?"
          message="This cannot be undone."
          onClose={() => setDeleteConfirmVisible(false)}
          buttons={[
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: executeDeletePost },
          ]}
          loading={deletePostMutation.isPending}
        />
      </Modal>
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
  rightActions: { flexDirection: "row", alignItems: "center", gap: 16, flexShrink: 0 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  bookBtn: { minHeight: 34, paddingHorizontal: 14, borderRadius: 14, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" },
  bookBtnText: { fontSize: 13, fontWeight: "700", lineHeight: 16 },
  actionCount: { fontSize: 16, fontWeight: "700" },
  commentsSection: { paddingHorizontal: 14, paddingTop: 8, gap: 6 },
  postTextBlock: { position: "relative" },
  titleEditWrap: { position: "relative", justifyContent: "center" },
  titleEditInput: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
    maxHeight: 120,
    paddingLeft: 12,
    paddingRight: 44,
    paddingVertical: 10,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "500",
  },
  titleSaveBtn: {
    position: "absolute",
    right: 6,
    bottom: 6,
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  titleSaveBtnDisabled: { opacity: 0.45 },
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
  },
  authorMain: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  authorContent: {
    flex: 1,
    minWidth: 0,
  },
  authorMetaHeader: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  authorBadgesRow: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 },
  authorNameRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 4, minWidth: 0 },
  authorGeoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  authorGeoContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
    minWidth: 0,
  },
  authorGeoIcon: { marginTop: 1, flexShrink: 0 },
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
  compactBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minHeight: 24,
    flexShrink: 0,
  },
  compactBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  authorActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
});
