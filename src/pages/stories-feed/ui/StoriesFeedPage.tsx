import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  InteractionManager,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewToken,
} from "react-native";
import { FlashList, type FlashListRef, type ListRenderItem } from "@shopify/flash-list";
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { useAuth } from "@/app/providers/AuthProvider";
import { useStoriesFeed, useStoriesStrip } from "@/entities/story";
import { usePostComments, usePostsFeed, useReactToPost } from "@/entities/post";
import {
  PostBoostConfirmModal,
  useBoostPost,
  usePostBoostConfirm,
  usePostBoostFeature,
} from "@/features/post-boost";
import { useMyFollowing, useProfile, useToggleFollow } from "@/entities/user";
import { useBusinessCards } from "@/entities/business-card";
import { preloadSmartImages } from "@/shared/ui/smart-image/SmartImage";
import { UserAvatarImage } from "@/shared/ui/user-avatar-image";
import { feedMediaDeviceDpr, getFeedPostCarouselImageUrls } from "@/shared/lib/feedMediaUrls";
import { getOptimizedImageUrlPreset } from "@/shared/lib/imagePresets";
import { ShimmerProvider } from "@/shared/ui/shimmer/ShimmerProvider";
import { ShimmerSurface } from "@/shared/ui/shimmer/ShimmerSurface";
import { AppHeader } from "@/shared/ui/app-header/AppHeader";
import { CommentsBottomSheet } from "@/shared/ui/comments-bottom-sheet/CommentsBottomSheet";
import { ShareBottomSheet } from "@/shared/ui/share-bottom-sheet/ShareBottomSheet";
import { StorySourcePickerModal } from "@/shared/ui/story-source-picker/StorySourcePickerModal";
import { profileDisplayName } from "@/shared/lib/profileDisplayName";
import { profileAvatar, profileAvatarDisplay, profileName, parseMediaUrls, resolveStorageUrl, type FeedPostVm, getPostImages, slideBlurhashesForPost } from "@/pages/stories-feed/lib/feedPostHelpers";
import type { BrowseFlowParamList, FeedStackParamList, RootTabParamList } from "@/app/navigation/types";
import type { StoryGroup } from "@/shared/model/types/stories";
import { useCreatePostComposer, CreatePostModal } from "@/features/create-post";
import { useBatchStoryUpload } from "@/features/create-story";
import { usePostShareSheet } from "@/features/post-share";
import { FeedPostCard } from "@/widgets/feed-post-card";
import { usePostCommentComposer } from "@/pages/stories-feed/model/usePostCommentComposer";
import { usePostLikes } from "@/pages/stories-feed/model/usePostLikes";
import { useFollowOverrides } from "@/pages/stories-feed/model/useFollowOverrides";
import Toast from "react-native-toast-message";
import { useCreatePostComment, useDeletePostComment, useUpdatePostComment } from "@/entities/post";
import { profileMentionTag } from "@/shared/lib/profileMentionTag";
import {
  DOUBLE_TAP_DELAY_MS,
  FEED_APP_HEADER_BODY,
  FEED_CAROUSEL_MAIN_BLOCK_MAX_RATIO,
  FEED_CAROUSEL_MIN_HEIGHT,
  FEED_CAROUSEL_VIEWPORT_RATIO,
  FEED_POST_LIST_ITEM_EXTRA_HEIGHT,
  FEED_STORIES_STRIP_HEIGHT,
  FEED_TAB_BAR_BASE,
} from "../model/constants";

export default function StoriesFeedScreen() {
  const { t } = useTranslation();
  const { colors, isDark, mode, setMode } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<BrowseFlowParamList>>();
  const rootNavigation = useNavigation<NavigationProp<RootTabParamList>>();
  const route = useRoute<RouteProp<FeedStackParamList, "FeedMain">>();
  const { user } = useAuth();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // ─── Data ────────────────────────────────────────────────────────────────
  const filterUserId = route.params?.filterUserId?.trim() ?? "";
  const {
    posts,
    isLoading,
    hasMore: hasMorePosts,
    loadMore: loadMorePosts,
    isFetchingNextPage: isFetchingMorePosts,
  } = usePostsFeed({
    authorUserId: filterUserId || undefined,
  });
  const { data: storiesStrip = [] } = useStoriesStrip();
  const {
    stories: feedStories = [],
    hasMore: hasMoreFeedStories,
    loadMore: loadMoreFeedStories,
    isFetchingNextPage: isFetchingMoreFeedStories,
  } = useStoriesFeed();
  const { followingSet } = useMyFollowing();
  const toggleFollow = useToggleFollow();
  const { data: myProfile } = useProfile();
  const { data: businessCards = [] } = useBusinessCards();

  // ─── Route params ────────────────────────────────────────────────────────
  const focusPostId = route.params?.focusPostId?.trim() ?? "";
  const focusStoryId = route.params?.focusStoryId?.trim() ?? "";

  // ─── Focused posts (global sort comes from usePostsFeed) ─────────────────
  const postBoostAccess = usePostBoostFeature();
  const boostPost = useBoostPost();
  const feedListRef = useRef<FlashListRef<FeedPostVm>>(null);

  const scrollFeedToTop = useCallback(() => {
    feedListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const postBoostConfirm = usePostBoostConfirm({
    boostPost,
    onScrollFeedToTop: scrollFeedToTop,
  });
  const focusedPosts = useMemo(() => {
    if (!focusPostId) return posts;
    const target = posts.find((p) => p.id === focusPostId);
    if (!target) return posts;
    return [target, ...posts.filter((p) => p.id !== focusPostId)];
  }, [focusPostId, posts]);

  // ─── Image sizing ────────────────────────────────────────────────────────
  const feedMainBlockHeight = useMemo(() => {
    const headerHeight = Math.max(insets.top, 10) + FEED_APP_HEADER_BODY;
    const tabBarHeight = FEED_TAB_BAR_BASE + Math.max(insets.bottom, 6) + (Platform.OS === "android" ? 8 : 0);
    return Math.max(0, height - headerHeight - FEED_STORIES_STRIP_HEIGHT - tabBarHeight);
  }, [height, insets.bottom, insets.top]);

  const sliderHeight = useMemo(() => {
    const fromViewport = Math.floor(height * FEED_CAROUSEL_VIEWPORT_RATIO);
    const maxFromMainBlock = Math.floor(feedMainBlockHeight * FEED_CAROUSEL_MAIN_BLOCK_MAX_RATIO);
    return Math.max(FEED_CAROUSEL_MIN_HEIGHT, Math.min(fromViewport, maxFromMainBlock));
  }, [feedMainBlockHeight, height]);

  const focusedPostVms = useMemo<FeedPostVm[]>(
    () =>
      focusedPosts.map((post) => {
        const postImagesRaw = getPostImages(post);
        const authorAvatarRaw = profileAvatar(post.profile?.avatar_url);
        const authorAvatar = profileAvatarDisplay(post.profile?.avatar_url);
        return {
          post,
          postImagesRaw,
          postImages: getFeedPostCarouselImageUrls(postImagesRaw),
          postSlideBlurhashes: slideBlurhashesForPost(post, postImagesRaw.length),
          authorAvatarRaw,
          authorAvatar,
        };
      }),
    [focusedPosts],
  );

  // ─── Stories ─────────────────────────────────────────────────────────────
  const topStories = useMemo(() => {
    if (!focusStoryId) return storiesStrip;
    const target = storiesStrip.find((s) => s.id === focusStoryId);
    if (!target) return storiesStrip;
    return [target, ...storiesStrip.filter((s) => s.id !== focusStoryId)];
  }, [focusStoryId, storiesStrip]);

  const onLoadMoreFeedStories = useCallback(() => {
    if (!hasMoreFeedStories || isFetchingMoreFeedStories) return;
    loadMoreFeedStories();
  }, [hasMoreFeedStories, isFetchingMoreFeedStories, loadMoreFeedStories]);

  const onLoadMorePosts = useCallback(() => {
    if (!hasMorePosts || isFetchingMorePosts) return;
    loadMorePosts();
  }, [hasMorePosts, isFetchingMorePosts, loadMorePosts]);

  const onFeedEndReached = useCallback(() => {
    onLoadMorePosts();
    onLoadMoreFeedStories();
  }, [onLoadMorePosts, onLoadMoreFeedStories]);

  const storyGroups = useMemo<StoryGroup[]>(() => {
    const grouped = new Map<string, StoryGroup>();
    for (const story of feedStories) {
      const existing = grouped.get(story.user_id);
      if (existing) { existing.stories.push(story); }
      else { grouped.set(story.user_id, { user_id: story.user_id, profile: story.profile, stories: [story] }); }
    }
    return Array.from(grouped.values());
  }, [feedStories]);

  const createStoryPlaceId =
    focusedPosts.find((p) => p.place_id)?.place_id ??
    posts.find((p) => p.place_id)?.place_id ??
    businessCards[0]?.id ??
    null;

  const currentUserAvatarUrl = useMemo(() => {
    const metadataAvatar =
      typeof user?.user_metadata === "object" && user?.user_metadata && "avatar_url" in user.user_metadata
        ? String((user.user_metadata as Record<string, unknown>).avatar_url ?? "")
        : "";
    return profileAvatarDisplay(myProfile?.avatar_url) ?? profileAvatarDisplay(metadataAvatar);
  }, [myProfile?.avatar_url, user?.user_metadata]);

  // ─── Feature hooks ───────────────────────────────────────────────────────
  const composer = useCreatePostComposer(businessCards, rootNavigation as NavigationProp<Record<string, object | undefined>>, height);
  const storyUpload = useBatchStoryUpload(createStoryPlaceId);
  const shareSheet = usePostShareSheet(rootNavigation as NavigationProp<Record<string, object | undefined>>);
  const { likes, likeCount, togglePostLike } = usePostLikes(useReactToPost());
  const { followOverrides, onToggleFollowAuthor } = useFollowOverrides(followingSet, toggleFollow);
  const comments = usePostCommentComposer();
  const createPostComment = useCreatePostComment();
  const updatePostComment = useUpdatePostComment();
  const deletePostComment = useDeletePostComment();
  const { data: postComments = [], isLoading: isPostCommentsLoading } = usePostComments(comments.selectedPostId ?? "");
  const isCommentsSheetLoading = Boolean(comments.selectedPostId) && isPostCommentsLoading;
  const savingCommentId =
    updatePostComment.isPending && updatePostComment.variables ? updatePostComment.variables.commentId : null;
  const deletingCommentId =
    deletePostComment.isPending && deletePostComment.variables ? deletePostComment.variables.commentId : null;

  const selectedPost = useMemo(
    () => focusedPosts.find((p) => p.id === comments.selectedPostId) ?? null,
    [focusedPosts, comments.selectedPostId],
  );

  // ─── Auth guard ──────────────────────────────────────────────────────────
  const redirectToAuth = useCallback(() => {
    rootNavigation.navigate("Profile", { screen: "Auth" });
  }, [rootNavigation]);

  const runAuthedAction = useCallback(
    (action: () => void) => { if (!user) { redirectToAuth(); return; } action(); },
    [redirectToAuth, user],
  );

  // ─── Story strip tap ─────────────────────────────────────────────────────
  const [storySourceModalVisible, setStorySourceModalVisible] = useState(false);

  // ─── Viewability preload ─────────────────────────────────────────────────
  const focusedPostVmsRef = useRef(focusedPostVms);
  focusedPostVmsRef.current = focusedPostVms;

  const feedViewabilityConfig = useMemo(() => ({ itemVisiblePercentThreshold: 45 }), []);

  const onFeedViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<FeedPostVm>[] }) => {
      const vms = focusedPostVmsRef.current;
      if (!viewableItems.length || !vms.length) return;
      let maxVisible = 0;
      for (const token of viewableItems) {
        if (token.isViewable && typeof token.index === "number") maxVisible = Math.max(maxVisible, token.index);
      }
      const windowEnd = Math.min(vms.length - 1, maxVisible + 2);
      const uris: string[] = [];
      for (let i = maxVisible; i <= windowEnd; i++) {
        const vm = vms[i];
        const first = vm?.postImages[0];
        if (first) uris.push(first);
      }
      InteractionManager.runAfterInteractions(() => { void preloadSmartImages(uris); });
    },
    [],
  );

  // ─── Double-tap to like ──────────────────────────────────────────────────
  const lastPostTapByIdRef = useRef<Record<string, number>>({});
  const onPostCardPress = useCallback(
    (postId: string, reactionCount: number) => {
      const now = Date.now();
      const lastTapAt = lastPostTapByIdRef.current[postId] ?? 0;
      if (now - lastTapAt <= DOUBLE_TAP_DELAY_MS) {
        lastPostTapByIdRef.current[postId] = 0;
        togglePostLike(postId, reactionCount, runAuthedAction);
        return;
      }
      lastPostTapByIdRef.current[postId] = now;
    },
    [togglePostLike, runAuthedAction],
  );

  const renderPostSeparator = useCallback(() => <View style={styles.postDivider} />, []);

  // ─── renderItem ──────────────────────────────────────────────────────────
  const renderFocusedFeedPost = useCallback<ListRenderItem<FeedPostVm>>(
    ({ item: vm }) => (
      <FeedPostCard
        vm={vm}
        width={width}
        sliderHeight={sliderHeight}
        isContentExpanded={!!comments.expandedPostContentIds[vm.post.id]}
        isLiked={!!likes[vm.post.id]}
        likeCount={likeCount[vm.post.id] ?? vm.post.reaction_count}
        currentUserId={user?.id}
        isFollowing={followOverrides[vm.post.user_id] ?? followingSet.has(vm.post.user_id)}
        followPending={toggleFollow.isPending}
        onPress={() => onPostCardPress(vm.post.id, vm.post.reaction_count)}
        onLike={() => togglePostLike(vm.post.id, vm.post.reaction_count, runAuthedAction)}
        onOpenComments={() => runAuthedAction(() => comments.openComments(vm.post.id))}
        onBookNow={() => runAuthedAction(() => navigation.navigate("BookingFlow", { id: vm.post.place_id! }))}
        onShare={() =>
          runAuthedAction(() =>
            shareSheet.openShareForPost({
              postId: vm.post.id,
              placeId: vm.post.place_id,
              images: vm.postImagesRaw,
              placeName: vm.post.business_card?.name ?? vm.post.place_name ?? "Place",
            }),
          )
        }
        onToggleContent={() => comments.toggleExpandContent(vm.post.id)}
        onToggleFollow={() =>
          runAuthedAction(() =>
            onToggleFollowAuthor(vm.post.user_id, profileName(vm.post.profile?.first_name, vm.post.profile?.last_name)),
          )
        }
        canBoost={postBoostAccess.enabled && vm.post.user_id === user?.id}
        isBoosted={Boolean(vm.post.boosted_at)}
        boostPending={postBoostConfirm.isBoostPending(vm.post.id)}
        onBoost={() =>
          runAuthedAction(() => postBoostConfirm.requestBoost(vm.post.id, vm.post.boosted_at))
        }
      />
    ),
    [
      comments,
      postBoostConfirm,
      followOverrides,
      followingSet,
      likeCount,
      likes,
      navigation,
      onPostCardPress,
      onToggleFollowAuthor,
      postBoostAccess.enabled,
      runAuthedAction,
      shareSheet,
      sliderHeight,
      toggleFollow.isPending,
      togglePostLike,
      user?.id,
      width,
    ],
  );

  // ─── Loading skeleton ────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={["top"]}>
        <ShimmerProvider active>
          <View style={styles.skeletonWrap}>
            <View style={styles.skeletonStoriesRow}>
              {Array.from({ length: 5 }).map((_, idx) => (
                <View key={`stories-skeleton-${idx}`} style={styles.skeletonStoryItem}>
                  <ShimmerSurface width={64} height={64} borderRadius={32} />
                  <ShimmerSurface width={56} height={10} borderRadius={6} />
                </View>
              ))}
            </View>
            {Array.from({ length: 2 }).map((_, idx) => (
              <View key={`post-skeleton-${idx}`} style={[styles.skeletonCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <ShimmerSurface width={width - 24} height={sliderHeight} borderRadius={0} />
                <View style={styles.skeletonActions}>
                  <ShimmerSurface width={58} height={18} borderRadius={9} />
                  <ShimmerSurface width={58} height={18} borderRadius={9} />
                </View>
                <ShimmerSurface width={180} height={14} borderRadius={7} style={styles.skeletonLinePad} />
                <ShimmerSurface width={220} height={14} borderRadius={7} style={styles.skeletonLineGap} />
              </View>
            ))}
          </View>
        </ShimmerProvider>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={[]}>
      <AppHeader
        title={t("header.feed")}
        leftIcon="add"
        onLeftPress={() => runAuthedAction(composer.openMenu)}
        rightIcon={isDark ? "sunny-outline" : "moon-outline"}
        onRightPress={() => setMode(mode === "dark" ? "light" : "dark")}
        notificationsEnabled
      />

      <FlashList
        ref={feedListRef}
        data={focusedPostVms}
        keyExtractor={(item) => item.post.id}
        estimatedItemSize={sliderHeight + FEED_POST_LIST_ITEM_EXTRA_HEIGHT}
        getItemType={() => "feed-post"}
        contentContainerStyle={styles.feedContent}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        initialNumToRender={4}
        maxToRenderPerBatch={6}
        windowSize={8}
        updateCellsBatchingPeriod={45}
        viewabilityConfig={feedViewabilityConfig}
        onViewableItemsChanged={onFeedViewableItemsChanged}
        onEndReachedThreshold={0.4}
        onEndReached={onFeedEndReached}
        renderItem={renderFocusedFeedPost}
        ItemSeparatorComponent={renderPostSeparator}
        ListFooterComponent={
          isFetchingMorePosts ? (
            <View style={styles.feedFooterLoader}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null
        }
        ListHeaderComponent={
          <StoriesStripHeader
            topStories={topStories}
            storyGroups={storyGroups}
            uploadingStory={storyUpload.uploadingStory}
            loadingMoreStories={isFetchingMoreFeedStories}
            colors={colors}
            navigation={navigation}
            onAddStory={() => runAuthedAction(composer.openMenu)}
            onLoadMoreStories={onLoadMoreFeedStories}
          />
        }
        ListEmptyComponent={
          <View style={[styles.emptyStateWrap, { minHeight: Math.max(260, Math.floor(height * 0.45)) }]}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No posts yet</Text>
          </View>
        }
      />

      <CommentsBottomSheet
        visible={comments.isCommentsModalVisible}
        onClose={comments.closeComments}
        comments={postComments}
        isLoading={isCommentsSheetLoading}
        hasSelectedPost={!!selectedPost}
        expandedCommentIds={comments.expandedCommentIds}
        replyTargetCommentId={comments.replyTargetCommentId}
        commentInput={comments.commentInput}
        canSendComment={comments.canSendComment(createPostComment.isPending)}
        submittingComment={createPostComment.isPending}
        currentUserId={user?.id}
        currentUserAvatarUrl={currentUserAvatarUrl}
        resolveAvatarUri={profileAvatarDisplay}
        savingCommentId={savingCommentId}
        deletingCommentId={deletingCommentId}
        onToggleReplies={comments.toggleReplies}
        onReplyPress={(commentId) =>
          runAuthedAction(() => {
            const parent = postComments.find((c) => c.id === commentId);
            comments.startReply(commentId, profileMentionTag(parent?.profile));
          })
        }
        onCancelReply={() => comments.cancelReply()}
        onChangeCommentInput={comments.setCommentInput}
        onSubmitComment={() => {
          runAuthedAction(() => {
            if (!comments.canSendComment(createPostComment.isPending) || !selectedPost) return;
            void createPostComment.mutateAsync({
              postId: selectedPost.id,
              parentCommentId: comments.replyTargetCommentId,
              content: comments.commentInput,
            });
            comments.cancelReply();
          });
        }}
        onSaveCommentEdit={(commentId, content) => {
          runAuthedAction(() => {
            if (!selectedPost) return;
            void updatePostComment.mutateAsync({
              postId: selectedPost.id,
              commentId,
              content,
            });
          });
        }}
        onDeleteComment={(commentId) => {
          runAuthedAction(() => {
            if (!selectedPost) return;
            if (comments.replyTargetCommentId === commentId) {
              comments.cancelReply();
            }
            void deletePostComment.mutateAsync({
              postId: selectedPost.id,
              commentId,
            });
          });
        }}
      />

      <PostBoostConfirmModal
        visible={postBoostConfirm.confirmVisible}
        mode={postBoostConfirm.popupMode}
        loading={postBoostConfirm.confirmLoading}
        onConfirm={() => void postBoostConfirm.confirmBoost()}
        onCancel={postBoostConfirm.cancelBoost}
      />

      <ShareBottomSheet
        visible={shareSheet.shareVisible}
        onClose={shareSheet.resetShareState}
        users={shareSheet.shareUsers}
        loading={shareSheet.shareUsersLoading}
        searchValue={shareSheet.shareSearch}
        onChangeSearch={shareSheet.setShareSearch}
        resolveAvatarUri={profileAvatarDisplay}
        sharePostId={shareSheet.sharePostId}
        sharePostHasMedia={shareSheet.sharePostImages.length > 0}
        sharePlaceName={shareSheet.sharePlaceName}
        shareSending={shareSheet.shareSending}
        sheetAlert={shareSheet.shareAlert}
        onDismissSheetAlert={shareSheet.dismissShareAlert}
        onShowSheetAlert={shareSheet.showShareAlertOptions}
        onAddToStory={async () => {
          shareSheet.handleShareToStory(navigation);
        }}
        onWhatsAppShare={shareSheet.handleShareToWhatsapp}
        onSystemShare={shareSheet.handleSystemShare}
        onCopyLink={shareSheet.handleCopyPostLink}
      />

      <CreatePostModal
        composer={composer}
        onOpenStory={() => setStorySourceModalVisible(true)}
        storyAvailable={Boolean(createStoryPlaceId)}
      />

      <StorySourcePickerModal
        visible={storySourceModalVisible}
        onClose={() => setStorySourceModalVisible(false)}
        onChoose={(source) => {
          setStorySourceModalVisible(false);
          storyUpload.onChooseStorySource(source);
        }}
      />
    </SafeAreaView>
  );
}

// ─── Stories strip header (inline widget) ────────────────────────────────────
function StoriesStripHeader({
  topStories,
  storyGroups,
  uploadingStory,
  loadingMoreStories,
  colors,
  navigation,
  onAddStory,
  onLoadMoreStories,
}: {
  topStories: ReturnType<typeof useStoriesStrip>["data"];
  storyGroups: StoryGroup[];
  uploadingStory: boolean;
  loadingMoreStories: boolean;
  colors: ReturnType<typeof useAppTheme>["colors"];
  navigation: NativeStackNavigationProp<BrowseFlowParamList>;
  onAddStory: () => void;
  onLoadMoreStories: () => void;
}) {
  const stripDpr = feedMediaDeviceDpr();
  const onStoriesStripScroll = useCallback(
    (offsetX: number, layoutWidth: number, contentWidth: number) => {
      if (layoutWidth + offsetX < contentWidth - 48) return;
      onLoadMoreStories();
    },
    [onLoadMoreStories],
  );

  return (
    <View style={styles.storiesHeaderWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storiesHeaderContent}
        scrollEventThrottle={200}
        onScroll={(event) => {
          const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
          onStoriesStripScroll(contentOffset.x, layoutMeasurement.width, contentSize.width);
        }}
      >
        <Pressable style={styles.storyBubble} disabled={uploadingStory} onPress={onAddStory}>
          <View style={[styles.storyBubbleRing, { borderColor: colors.border }]}>
            <View style={[styles.storyBubbleAvatar, { backgroundColor: colors.card }]}>
              <Ionicons name="person-outline" size={28} color={colors.textMuted} />
              <View style={[styles.storyPlusBadge, { backgroundColor: colors.primary }]}>
                {uploadingStory ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Ionicons name="add" size={14} color={colors.onPrimary} />
                )}
              </View>
            </View>
          </View>
          <Text style={[styles.storyBubbleName, { color: colors.text }]} numberOfLines={1}>Add story</Text>
        </Pressable>

        {(topStories ?? []).map((story) => {
          const name = profileDisplayName(story.profile);
          const storyMedia = parseMediaUrls(story.media_url);
          const storyPreviewRaw = storyMedia[0] ? resolveStorageUrl(storyMedia[0], "stories") : null;
          const storyPreviewOpt = storyPreviewRaw
            ? getOptimizedImageUrlPreset(storyPreviewRaw, "thumb", { dpr: stripDpr }) || storyPreviewRaw
            : null;
          const avatarRaw = profileAvatar(story.profile?.avatar_url);
          const avatarOpt = profileAvatarDisplay(story.profile?.avatar_url);
          const bubbleUri = storyPreviewOpt ?? avatarOpt;
          const bubbleFallback = storyPreviewRaw ?? avatarRaw;
          const bubbleBlur = storyPreviewRaw
            ? typeof story.media_blurhashes?.[0] === "string" ? story.media_blurhashes[0] : undefined
            : undefined;
          const targetGroupIndex = storyGroups.findIndex((g) => g.user_id === story.user_id);

          return (
            <Pressable
              key={`story-bubble-${story.id}`}
              style={styles.storyBubble}
              onPress={() => {
                if (targetGroupIndex < 0) return;
                const group = storyGroups[targetGroupIndex];
                const targetStoryIndex = Math.max(0, group.stories.findIndex((s) => s.id === story.id));
                navigation.navigate("FeedStoryViewer", {
                  groups: storyGroups,
                  initialGroupIndex: targetGroupIndex,
                  initialStoryIndex: targetStoryIndex,
                  placeId: group.stories[targetStoryIndex]?.place_id ?? "",
                });
              }}
            >
              <View style={[styles.storyBubbleRing, { borderColor: colors.primary }]}>
                <UserAvatarImage
                  uri={bubbleUri}
                  fallbackUri={bubbleFallback}
                  blurhash={bubbleBlur}
                  style={styles.storyBubbleAvatar}
                  contentFit="cover"
                  iconSize={28}
                />
              </View>
              <Text style={[styles.storyBubbleName, { color: colors.text }]} numberOfLines={1}>{name}</Text>
            </Pressable>
          );
        })}
        {loadingMoreStories ? (
          <View style={styles.storyBubble}>
            <ActivityIndicator color={colors.primary} style={styles.storyStripLoader} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  skeletonWrap: { paddingHorizontal: 12, paddingTop: 8, gap: 10 },
  skeletonStoriesRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 4 },
  skeletonStoryItem: { width: 72, alignItems: "center", gap: 8 },
  skeletonCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, overflow: "hidden", paddingBottom: 12, gap: 10 },
  skeletonActions: { flexDirection: "row", gap: 10, paddingHorizontal: 12 },
  skeletonLineGap: { marginTop: -4, marginLeft: 12 },
  skeletonLinePad: { marginLeft: 12 },
  emptyText: { fontSize: 14 },
  emptyStateWrap: { alignItems: "center", justifyContent: "center" },
  feedContent: { paddingBottom: 12 },
  feedFooterLoader: { paddingVertical: 24, alignItems: "center" },
  postDivider: { height: 10, width: "100%" },
  storiesHeaderWrap: { paddingTop: 8, paddingBottom: 8 },
  storiesHeaderContent: { paddingHorizontal: 12, gap: 12 },
  storyBubble: { width: 72, alignItems: "center", gap: 6 },
  storyBubbleRing: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  storyBubbleAvatar: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  storyPlusBadge: { position: "absolute", right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  storyBubbleName: { fontSize: 12, textAlign: "center" },
  storyStripLoader: { marginTop: 20 },
});
