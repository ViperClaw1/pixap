import { useCallback, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  useCreatePostComment,
  useDeletePostComment,
  usePostById,
  usePostComments,
  useReactToPost,
  useUpdatePostComment,
} from "@/entities/post";
import { useMyFollowing, useProfile, useToggleFollow } from "@/entities/user";
import { CommentsBottomSheet } from "@/shared/ui/comments-bottom-sheet/CommentsBottomSheet";
import { ShareBottomSheet } from "@/shared/ui/share-bottom-sheet/ShareBottomSheet";
import { FeedPostCard } from "@/widgets/feed-post-card";
import { usePostShareSheet } from "@/features/post-share";
import { usePostCommentComposer } from "@/pages/stories-feed/model/usePostCommentComposer";
import { usePostLikes } from "@/pages/stories-feed/model/usePostLikes";
import { useFollowOverrides } from "@/pages/stories-feed/model/useFollowOverrides";
import {
  FEED_CAROUSEL_MIN_HEIGHT,
  FEED_CAROUSEL_VIEWPORT_RATIO,
  DOUBLE_TAP_DELAY_MS,
} from "@/pages/stories-feed/model/constants";
import {
  getPostImages,
  profileAvatar,
  profileAvatarDisplay,
  slideBlurhashesForPost,
  type FeedPostVm,
} from "@/pages/stories-feed/lib/feedPostHelpers";
import type { BrowseFlowParamList, RootTabParamList } from "@/app/navigation/types";
import { getFeedPostCarouselImageUrls } from "@/shared/lib/feedMediaUrls";
import { profileMentionTag } from "@/shared/lib/profileMentionTag";

type PostDetailRoute = RouteProp<BrowseFlowParamList, "PostDetail">;

export default function PostDetailPage() {
  const { colors } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<BrowseFlowParamList>>();
  const rootNavigation = useNavigation<NavigationProp<RootTabParamList>>();
  const route = useRoute<PostDetailRoute>();
  const postId = route.params.postId.trim();
  const { user } = useAuth();
  const { width, height } = useWindowDimensions();

  const { data: post, isLoading, isError, refetch } = usePostById(postId);
  const { followingSet } = useMyFollowing();
  const toggleFollow = useToggleFollow();
  const { data: myProfile } = useProfile();

  const shareSheet = usePostShareSheet(rootNavigation);
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

  const sliderHeight = useMemo(() => {
    const fromViewport = Math.floor(height * FEED_CAROUSEL_VIEWPORT_RATIO);
    return Math.max(FEED_CAROUSEL_MIN_HEIGHT, fromViewport);
  }, [height]);

  const postVm = useMemo<FeedPostVm | null>(() => {
    if (!post) return null;
    const postImagesRaw = getPostImages(post);
    return {
      post,
      postImagesRaw,
      postImages: getFeedPostCarouselImageUrls(postImagesRaw),
      postSlideBlurhashes: slideBlurhashesForPost(post, postImagesRaw.length),
      authorAvatarRaw: profileAvatar(post.profile?.avatar_url),
      authorAvatar: profileAvatarDisplay(post.profile?.avatar_url),
    };
  }, [post]);

  const currentUserAvatarUrl = useMemo(() => {
    const metadataAvatar =
      typeof user?.user_metadata === "object" && user?.user_metadata && "avatar_url" in user.user_metadata
        ? String((user.user_metadata as Record<string, unknown>).avatar_url ?? "")
        : "";
    return profileAvatarDisplay(myProfile?.avatar_url) ?? profileAvatarDisplay(metadataAvatar);
  }, [myProfile?.avatar_url, user?.user_metadata]);

  const redirectToAuth = useCallback(() => {
    rootNavigation.navigate("Profile", { screen: "Auth" });
  }, [rootNavigation]);

  const runAuthedAction = useCallback(
    (action: () => void) => {
      if (!user) {
        redirectToAuth();
        return;
      }
      action();
    },
    [redirectToAuth, user],
  );

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    rootNavigation.navigate("Feed", { screen: "FeedMain" });
  }, [navigation, rootNavigation]);

  const lastPostTapRef = useRef(0);
  const onPostCardPress = useCallback(() => {
    if (!post) return;
    const now = Date.now();
    if (now - lastPostTapRef.current <= DOUBLE_TAP_DELAY_MS) {
      lastPostTapRef.current = 0;
      togglePostLike(post.id, post.reaction_count, runAuthedAction);
      return;
    }
    lastPostTapRef.current = now;
  }, [post, runAuthedAction, togglePostLike]);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (isError || !post || !postVm) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.background, padding: 24 }]}>
        <Text style={[styles.errorTitle, { color: colors.text }]}>Post not found</Text>
        <Text style={[styles.errorBody, { color: colors.textMuted }]}>
          This post may have been removed or is unavailable.
        </Text>
        <Pressable style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={() => void refetch()}>
          <Text style={{ color: colors.onPrimary, fontWeight: "600" }}>Retry</Text>
        </Pressable>
        <Pressable onPress={goBack} style={styles.backLink}>
          <Text style={{ color: colors.primary }}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={goBack} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          Post
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <FeedPostCard
          vm={postVm}
          width={width}
          sliderHeight={sliderHeight}
          isContentExpanded={!!comments.expandedPostContentIds[post.id]}
          isLiked={!!likes[post.id]}
          likeCount={likeCount[post.id] ?? post.reaction_count}
          currentUserId={user?.id}
          isFollowing={followOverrides[post.user_id] ?? followingSet.has(post.user_id)}
          followPending={toggleFollow.isPending}
          onPress={onPostCardPress}
          onLike={() => togglePostLike(post.id, post.reaction_count, runAuthedAction)}
          onOpenComments={() => runAuthedAction(() => comments.openComments(post.id))}
          onBookNow={() => runAuthedAction(() => navigation.navigate("BookingFlow", { id: post.place_id! }))}
          onShare={() =>
            runAuthedAction(() =>
              shareSheet.openShareForPost({
                postId: post.id,
                placeId: post.place_id,
                images: postVm.postImagesRaw,
                placeName: post.business_card?.name ?? post.place_name ?? "Place",
              }),
            )
          }
          onToggleContent={() => comments.toggleExpandContent(post.id)}
          onToggleFollow={() => void onToggleFollowAuthor(post.user_id)}
        />
      </ScrollView>

      <CommentsBottomSheet
        visible={comments.isCommentsModalVisible}
        onClose={comments.closeComments}
        comments={postComments}
        isLoading={isCommentsSheetLoading}
        hasSelectedPost
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
            if (!comments.canSendComment(createPostComment.isPending)) return;
            void createPostComment.mutateAsync({
              postId: post.id,
              parentCommentId: comments.replyTargetCommentId,
              content: comments.commentInput,
            });
            comments.cancelReply();
          });
        }}
        onSaveCommentEdit={(commentId, content) => {
          runAuthedAction(() => {
            void updatePostComment.mutateAsync({ postId: post.id, commentId, content });
          });
        }}
        onDeleteComment={(commentId) => {
          runAuthedAction(() => {
            if (comments.replyTargetCommentId === commentId) comments.cancelReply();
            void deletePostComment.mutateAsync({ postId: post.id, commentId });
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
        resolveAvatarUri={profileAvatarDisplay}
        sharePostId={shareSheet.sharePostId}
        sharePostHasMedia={shareSheet.sharePostImages.length > 0}
        sharePlaceName={shareSheet.sharePlaceName}
        shareSending={shareSheet.shareSending}
        sheetAlert={shareSheet.shareAlert}
        onDismissSheetAlert={shareSheet.dismissShareAlert}
        onShowSheetAlert={shareSheet.showShareAlertOptions}
        onAddToStory={async () => shareSheet.handleShareToStory(navigation)}
        onWhatsAppShare={shareSheet.handleShareToWhatsapp}
        onSystemShare={shareSheet.handleSystemShare}
        onCopyLink={shareSheet.handleCopyPostLink}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "600",
  },
  headerSpacer: {
    width: 40,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  errorBody: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  backLink: {
    padding: 8,
  },
});
