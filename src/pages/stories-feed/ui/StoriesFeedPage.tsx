import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  InteractionManager,
  PixelRatio,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewToken,
} from "react-native";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { useAuth } from "@/app/providers/AuthProvider";
import { useStoriesFeed, useStoriesStrip } from "@/entities/story";
import { usePostComments, usePostsFeed, useReactToPost } from "@/entities/post";
import { useMyFollowing, useProfile, useToggleFollow } from "@/entities/user";
import { useBusinessCards } from "@/entities/business-card";
import { SmartImage, preloadSmartImages } from "@/shared/ui/smart-image/SmartImage";
import { getOptimizedImageUrl, quantizeDecodePx } from "@/shared/lib/imageUtils";
import { getOptimizedImageUrlPreset } from "@/shared/lib/imagePresets";
import { ShimmerProvider } from "@/shared/ui/shimmer/ShimmerProvider";
import { ShimmerSurface } from "@/shared/ui/shimmer/ShimmerSurface";
import { AppHeader } from "@/shared/ui/app-header/AppHeader";
import { CommentsBottomSheet } from "@/shared/ui/comments-bottom-sheet/CommentsBottomSheet";
import { ShareBottomSheet } from "@/shared/ui/share-bottom-sheet/ShareBottomSheet";
import { StorySourcePickerModal } from "@/shared/ui/story-source-picker/StorySourcePickerModal";
import { profileDisplayName } from "@/shared/lib/profileDisplayName";
import { profileAvatar, profileName, parseMediaUrls, resolveStorageUrl, type FeedPostVm, getPostImages, slideBlurhashesForPost } from "@/pages/stories-feed/lib/feedPostHelpers";
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
import { useCreatePostComment } from "@/entities/post";
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
  const { posts, isLoading } = usePostsFeed();
  const { data: storiesStrip = [] } = useStoriesStrip();
  const { stories: feedStories = [] } = useStoriesFeed();
  const { followingSet } = useMyFollowing();
  const toggleFollow = useToggleFollow();
  const { data: myProfile } = useProfile();
  const { data: businessCards = [] } = useBusinessCards();

  // ─── Route params ────────────────────────────────────────────────────────
  const focusPostId = route.params?.focusPostId?.trim() ?? "";
  const focusStoryId = route.params?.focusStoryId?.trim() ?? "";
  const filterUserId = route.params?.filterUserId?.trim() ?? "";
  const routePostsScope = route.params?.postsScope;
  const [postsScope, setPostsScope] = useState<"all" | "mine">(routePostsScope ?? (filterUserId ? "mine" : "all"));

  useEffect(() => {
    if (routePostsScope) { setPostsScope(routePostsScope); return; }
    if (filterUserId) setPostsScope("mine");
  }, [filterUserId, routePostsScope]);

  const effectiveFilterUserId = postsScope === "mine" ? (filterUserId || user?.id || "") : "";

  // ─── Sorted & focused posts ──────────────────────────────────────────────
  const sortedPosts = useMemo(
    () => [...posts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [posts],
  );
  const filteredPosts = useMemo(
    () => (effectiveFilterUserId ? sortedPosts.filter((p) => p.user_id === effectiveFilterUserId) : sortedPosts),
    [effectiveFilterUserId, sortedPosts],
  );
  const focusedPosts = useMemo(() => {
    if (!focusPostId) return filteredPosts;
    const target = filteredPosts.find((p) => p.id === focusPostId);
    if (!target) return filteredPosts;
    return [target, ...filteredPosts.filter((p) => p.id !== focusPostId)];
  }, [filterUserId, focusPostId, filteredPosts]);

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

  const optimizedPostImageSize = useMemo(() => {
    const dpr = PixelRatio.get();
    return { width: quantizeDecodePx(Math.round(width * dpr)), height: quantizeDecodePx(Math.round(sliderHeight * dpr)) };
  }, [sliderHeight, width]);

  const focusedPostVms = useMemo<FeedPostVm[]>(
    () =>
      focusedPosts.map((post) => {
        const postImagesRaw = getPostImages(post);
        const dpr = PixelRatio.get();
        const authorAvatarRaw = profileAvatar(post.profile?.avatar_url);
        const authorAvatar = authorAvatarRaw
          ? getOptimizedImageUrlPreset(authorAvatarRaw, "thumb", { dpr }) || authorAvatarRaw
          : null;
        return {
          post,
          postImagesRaw,
          postImages: postImagesRaw.map(
            (url) => getOptimizedImageUrl(url, optimizedPostImageSize.width, optimizedPostImageSize.height, 78) || url,
          ),
          postSlideBlurhashes: slideBlurhashesForPost(post, postImagesRaw.length),
          authorAvatarRaw,
          authorAvatar,
        };
      }),
    [focusedPosts, optimizedPostImageSize.height, optimizedPostImageSize.width],
  );

  // ─── Stories ─────────────────────────────────────────────────────────────
  const topStories = useMemo(() => {
    if (!focusStoryId) return storiesStrip;
    const target = storiesStrip.find((s) => s.id === focusStoryId);
    if (!target) return storiesStrip;
    return [target, ...storiesStrip.filter((s) => s.id !== focusStoryId)];
  }, [focusStoryId, storiesStrip]);

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
    sortedPosts.find((p) => p.place_id)?.place_id ??
    businessCards[0]?.id ??
    null;

  const currentUserAvatarUrl = useMemo(() => {
    const metadataAvatar =
      typeof user?.user_metadata === "object" && user?.user_metadata && "avatar_url" in user.user_metadata
        ? String((user.user_metadata as Record<string, unknown>).avatar_url ?? "")
        : "";
    return profileAvatar(myProfile?.avatar_url) ?? profileAvatar(metadataAvatar);
  }, [myProfile?.avatar_url, user?.user_metadata]);

  // ─── Feature hooks ───────────────────────────────────────────────────────
  const composer = useCreatePostComposer(businessCards, rootNavigation as NavigationProp<Record<string, object | undefined>>, height);
  const storyUpload = useBatchStoryUpload(createStoryPlaceId);
  const shareSheet = usePostShareSheet(rootNavigation as NavigationProp<Record<string, object | undefined>>);
  const { likes, likeCount, togglePostLike } = usePostLikes(useReactToPost());
  const { followOverrides, onToggleFollowAuthor } = useFollowOverrides(followingSet, toggleFollow);
  const comments = usePostCommentComposer();
  const createPostComment = useCreatePostComment();
  const { data: postComments = [] } = usePostComments(comments.selectedPostId ?? "");

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
      const windowEnd = Math.min(vms.length - 1, maxVisible + 4);
      const uris: string[] = [];
      for (let i = maxVisible; i <= windowEnd; i++) {
        const vm = vms[i];
        if (vm) for (const u of vm.postImages.slice(0, 2)) if (u) uris.push(u);
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
      />
    ),
    [
      comments, followOverrides, followingSet, likeCount, likes, navigation, onPostCardPress,
      onToggleFollowAuthor, runAuthedAction, shareSheet, sliderHeight, toggleFollow.isPending,
      togglePostLike, user?.id, width,
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
                  <ShimmerSurface width={64} height={64} borderRadius={32} isDark={isDark} />
                  <ShimmerSurface width={56} height={10} borderRadius={6} isDark={isDark} />
                </View>
              ))}
            </View>
            {Array.from({ length: 2 }).map((_, idx) => (
              <View key={`post-skeleton-${idx}`} style={[styles.skeletonCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <ShimmerSurface width={width - 24} height={sliderHeight} isDark={isDark} borderRadius={0} />
                <View style={styles.skeletonActions}>
                  <ShimmerSurface width={58} height={18} borderRadius={9} isDark={isDark} />
                  <ShimmerSurface width={58} height={18} borderRadius={9} isDark={isDark} />
                </View>
                <ShimmerSurface width={180} height={14} borderRadius={7} isDark={isDark} style={styles.skeletonLinePad} />
                <ShimmerSurface width={220} height={14} borderRadius={7} isDark={isDark} style={styles.skeletonLineGap} />
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
        renderItem={renderFocusedFeedPost}
        ListHeaderComponent={
          <StoriesStripHeader
            topStories={topStories}
            storyGroups={storyGroups}
            uploadingStory={storyUpload.uploadingStory}
            colors={colors}
            navigation={navigation}
            onAddStory={() => runAuthedAction(composer.openMenu)}
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
        hasSelectedPost={!!selectedPost}
        expandedCommentIds={comments.expandedCommentIds}
        replyTargetCommentId={comments.replyTargetCommentId}
        commentInput={comments.commentInput}
        canSendComment={comments.canSendComment(createPostComment.isPending)}
        submittingComment={createPostComment.isPending}
        currentUserAvatarUrl={currentUserAvatarUrl}
        resolveAvatarUri={profileAvatar}
        formatRelativeTime={(v) => {
          const { formatRelativeTime: fmt } = require("@/shared/lib/formatRelativeTime");
          return fmt(v);
        }}
        onToggleReplies={comments.toggleReplies}
        onReplyPress={(commentId) => runAuthedAction(() => comments.setReplyTargetCommentId(commentId))}
        onCancelReply={() => comments.setReplyTargetCommentId(null)}
        onChangeCommentInput={comments.setCommentInput}
        onSubmitComment={() => {
          runAuthedAction(() => {
            if (!comments.canSendComment(createPostComment.isPending) || !selectedPost) return;
            void createPostComment.mutateAsync({
              postId: selectedPost.id,
              parentCommentId: comments.replyTargetCommentId,
              content: comments.commentInput,
            });
            comments.setCommentInput("");
            comments.setReplyTargetCommentId(null);
          });
        }}
      />

      <ShareBottomSheet
        visible={shareSheet.shareVisible}
        onClose={shareSheet.resetShareState}
        users={shareSheet.shareUsers}
        loading={shareSheet.shareUsersLoading}
        searchValue={shareSheet.shareSearch}
        onChangeSearch={shareSheet.setShareSearch}
        resolveAvatarUri={profileAvatar}
        sharePostId={shareSheet.sharePostId}
        sharePostHasMedia={shareSheet.sharePostImages.length > 0}
        sharePlaceName={shareSheet.sharePlaceName}
        shareSending={shareSheet.shareSending}
        onAddToStory={async () => shareSheet.handleShareToStory(navigation)}
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
  colors,
  navigation,
  onAddStory,
}: {
  topStories: ReturnType<typeof useStoriesStrip>["data"];
  storyGroups: StoryGroup[];
  uploadingStory: boolean;
  colors: ReturnType<typeof useAppTheme>["colors"];
  navigation: NativeStackNavigationProp<BrowseFlowParamList>;
  onAddStory: () => void;
}) {
  const stripDpr = PixelRatio.get();
  return (
    <View style={styles.storiesHeaderWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesHeaderContent}>
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
          const avatarOpt = avatarRaw ? getOptimizedImageUrlPreset(avatarRaw, "thumb", { dpr: stripDpr }) || avatarRaw : null;
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
                {bubbleUri ? (
                  <SmartImage uri={bubbleUri} fallbackUri={bubbleFallback} blurhash={bubbleBlur} style={styles.storyBubbleAvatar} contentFit="cover" />
                ) : (
                  <View style={[styles.storyBubbleAvatar, { backgroundColor: colors.card }]} />
                )}
              </View>
              <Text style={[styles.storyBubbleName, { color: colors.text }]} numberOfLines={1}>{name}</Text>
            </Pressable>
          );
        })}
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
  feedContent: { paddingBottom: 12, gap: 8 },
  storiesHeaderWrap: { paddingTop: 8, paddingBottom: 8 },
  storiesHeaderContent: { paddingHorizontal: 12, gap: 12 },
  storyBubble: { width: 72, alignItems: "center", gap: 6 },
  storyBubbleRing: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  storyBubbleAvatar: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  storyPlusBadge: { position: "absolute", right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  storyBubbleName: { fontSize: 12, textAlign: "center" },
});
