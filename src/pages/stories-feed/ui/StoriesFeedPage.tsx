import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  InteractionManager,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewToken,
} from "react-native";
import { FlashList, type FlashListRef, type ListRenderItem } from "@shopify/flash-list";
import { useNavigation, useRoute, useIsFocused, type NavigationProp, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { useAuth } from "@/app/providers/AuthProvider";
import { useStoriesFeed, useStoriesStrip, buildStoryGroupsFromFeedAndStrip } from "@/entities/story";
import { usePostsFeed, useReactToPost } from "@/entities/post";
import {
  PostBoostConfirmModal,
  useBoostPost,
  usePostBoostConfirm,
  usePostBoostFeature,
} from "@/features/post-boost";
import { useMyFollowing, useToggleFollow } from "@/entities/user";
import { useBusinessCards } from "@/entities/business-card";
import { preloadSmartImages } from "@/shared/ui/smart-image/SmartImage";
import { UserAvatarImage } from "@/shared/ui/user-avatar-image";
import { getFeedPostCarouselImageUrls } from "@/shared/lib/feedMediaUrls";
import { ShimmerProvider } from "@/shared/ui/shimmer/ShimmerProvider";
import { ShimmerSurface } from "@/shared/ui/shimmer/ShimmerSurface";
import { AppHeader } from "@/shared/ui/app-header/AppHeader";
import { AppPressable } from "@/shared/ui/app-pressable";
import { ShareBottomSheet } from "@/shared/ui/share-bottom-sheet/ShareBottomSheet";
import { StorySourcePickerModal } from "@/shared/ui/story-source-picker/StorySourcePickerModal";
import { profileDisplayName } from "@/shared/lib/profileDisplayName";
import { profileAvatar, profileAvatarDisplay, profileName, getPostImages, slideBlurhashesForPost, type FeedPostVm } from "@/pages/stories-feed/lib/feedPostHelpers";
import type { BrowseFlowParamList, FeedStackParamList, RootTabParamList } from "@/app/navigation/types";
import type { StoryGroup } from "@/shared/model/types/stories";
import { useCreatePostComposer, CreatePostModal } from "@/features/create-post";
import { useBatchStoryUpload } from "@/features/create-story";
import { usePostShareSheet } from "@/features/post-share";
import { FeedPostCard } from "@/widgets/feed-post-card";
import { usePostCommentComposer } from "@/pages/stories-feed/model/usePostCommentComposer";
import { usePostLikes } from "@/pages/stories-feed/model/usePostLikes";
import { useFollowOverrides } from "@/pages/stories-feed/model/useFollowOverrides";
import {
  DOUBLE_TAP_DELAY_MS,
  FEED_APP_HEADER_BODY,
  FEED_CAROUSEL_HEIGHT_BOOST,
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
  const isScreenFocused = useIsFocused();

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
    return (
      Math.max(FEED_CAROUSEL_MIN_HEIGHT, Math.min(fromViewport, maxFromMainBlock)) + FEED_CAROUSEL_HEIGHT_BOOST
    );
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

  const storyGroups = useMemo(
    () => buildStoryGroupsFromFeedAndStrip(feedStories, storiesStrip),
    [feedStories, storiesStrip],
  );

  const createStoryPlaceId =
    focusedPosts.find((p) => p.place_id)?.place_id ??
    posts.find((p) => p.place_id)?.place_id ??
    businessCards[0]?.id ??
    null;

  // ─── Feature hooks ───────────────────────────────────────────────────────
  const composer = useCreatePostComposer(businessCards, rootNavigation as NavigationProp<Record<string, object | undefined>>, height);
  const storyUpload = useBatchStoryUpload(createStoryPlaceId);
  const shareSheet = usePostShareSheet(rootNavigation as NavigationProp<Record<string, object | undefined>>);
  const { likes, likeCount, togglePostLike } = usePostLikes(useReactToPost());
  const { followOverrides, onToggleFollowAuthor } = useFollowOverrides(followingSet, toggleFollow);
  const comments = usePostCommentComposer();

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

  const feedCardHandlersRef = useRef({
    onPostCardPress,
    togglePostLike,
    runAuthedAction,
    navigation,
    shareSheet,
    comments,
    onToggleFollowAuthor,
    postBoostConfirm,
    postBoostAccessEnabled: postBoostAccess.enabled,
    currentUserId: user?.id,
    isScreenFocused,
    toggleFollowPending: toggleFollow.isPending,
    followingSet,
    followOverrides,
    likeCount,
    likes,
    width,
    sliderHeight,
  });
  feedCardHandlersRef.current = {
    onPostCardPress,
    togglePostLike,
    runAuthedAction,
    navigation,
    shareSheet,
    comments,
    onToggleFollowAuthor,
    postBoostConfirm,
    postBoostAccessEnabled: postBoostAccess.enabled,
    currentUserId: user?.id,
    isScreenFocused,
    toggleFollowPending: toggleFollow.isPending,
    followingSet,
    followOverrides,
    likeCount,
    likes,
    width,
    sliderHeight,
  };

  const handleFeedPostPress = useCallback((postId: string, reactionCount: number) => {
    feedCardHandlersRef.current.onPostCardPress(postId, reactionCount);
  }, []);
  const handleFeedPostLike = useCallback((postId: string, reactionCount: number) => {
    const h = feedCardHandlersRef.current;
    h.togglePostLike(postId, reactionCount, h.runAuthedAction);
  }, []);
  const handleFeedOpenComments = useCallback((postId: string) => {
    const h = feedCardHandlersRef.current;
    h.runAuthedAction(() => h.navigation.navigate("PostDiscussion", { postId }));
  }, []);
  const handleFeedBookNow = useCallback((placeId: string) => {
    const h = feedCardHandlersRef.current;
    h.runAuthedAction(() => h.navigation.navigate("BookingFlow", { id: placeId }));
  }, []);
  const handleFeedShare = useCallback(
    (postId: string, placeId: string | null, images: string[], placeName: string) => {
      const h = feedCardHandlersRef.current;
      h.runAuthedAction(() =>
        h.shareSheet.openShareForPost({ postId, placeId, images, placeName }),
      );
    },
    [],
  );
  const handleFeedToggleContent = useCallback((postId: string) => {
    feedCardHandlersRef.current.comments.toggleExpandContent(postId);
  }, []);
  const handleFeedToggleFollow = useCallback((authorUserId: string, authorLabel: string) => {
    const h = feedCardHandlersRef.current;
    h.runAuthedAction(() => h.onToggleFollowAuthor(authorUserId, authorLabel));
  }, []);
  const handleFeedBoost = useCallback((postId: string, boostedAt: string | null | undefined) => {
    const h = feedCardHandlersRef.current;
    h.runAuthedAction(() => h.postBoostConfirm.requestBoost(postId, boostedAt));
  }, []);

  // ─── renderItem ──────────────────────────────────────────────────────────
  const renderFocusedFeedPost = useCallback<ListRenderItem<FeedPostVm>>(
    ({ item: vm }) => {
      const h = feedCardHandlersRef.current;
      return (
        <FeedPostCard
          vm={vm}
          width={h.width}
          sliderHeight={h.sliderHeight}
          isContentExpanded={!!h.comments.expandedPostContentIds[vm.post.id]}
          isLiked={!!h.likes[vm.post.id]}
          likeCount={h.likeCount[vm.post.id] ?? vm.post.reaction_count}
          currentUserId={h.currentUserId}
          isFollowing={h.followOverrides[vm.post.user_id] ?? h.followingSet.has(vm.post.user_id)}
          followPending={h.toggleFollowPending}
          onPress={() => handleFeedPostPress(vm.post.id, vm.post.reaction_count)}
          onLike={() => handleFeedPostLike(vm.post.id, vm.post.reaction_count)}
          onOpenComments={() => handleFeedOpenComments(vm.post.id)}
          onBookNow={() => vm.post.place_id && handleFeedBookNow(vm.post.place_id)}
          onShare={() =>
            handleFeedShare(
              vm.post.id,
              vm.post.place_id,
              vm.postImagesRaw,
              vm.post.business_card?.name ?? vm.post.place_name ?? "Place",
            )
          }
          onToggleContent={() => handleFeedToggleContent(vm.post.id)}
          onToggleFollow={() =>
            handleFeedToggleFollow(
              vm.post.user_id,
              profileName(vm.post.profile?.first_name, vm.post.profile?.last_name),
            )
          }
          canBoost={h.postBoostAccessEnabled && vm.post.user_id === h.currentUserId}
          isBoosted={Boolean(vm.post.boosted_at)}
          boostPending={h.postBoostConfirm.isBoostPending(vm.post.id)}
          onBoost={() => handleFeedBoost(vm.post.id, vm.post.boosted_at)}
          carouselAutoPlay={h.isScreenFocused}
        />
      );
    },
    [
      handleFeedBookNow,
      handleFeedBoost,
      handleFeedOpenComments,
      handleFeedPostLike,
      handleFeedPostPress,
      handleFeedShare,
      handleFeedToggleContent,
      handleFeedToggleFollow,
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
        nestedScrollEnabled={Platform.OS === "android"}
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
        <AppPressable style={styles.storyBubble} disabled={uploadingStory} onPress={onAddStory}>
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
        </AppPressable>

        {(topStories ?? []).map((story) => {
          const name = profileDisplayName(story.profile);
          const targetGroupIndex = storyGroups.findIndex((g) => g.user_id === story.user_id);

          return (
            <AppPressable
              key={`story-bubble-${story.id}`}
              style={styles.storyBubble}
              onPress={() => {
                if (targetGroupIndex < 0) {
                  navigation.navigate("FeedStoryViewer", { storyId: story.id });
                  return;
                }
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
                  uri={story.profile?.avatar_url}
                  style={styles.storyBubbleAvatar}
                  contentFit="cover"
                  iconSize={28}
                />
              </View>
              <Text style={[styles.storyBubbleName, { color: colors.text }]} numberOfLines={1}>
                {name}
              </Text>
            </AppPressable>
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
