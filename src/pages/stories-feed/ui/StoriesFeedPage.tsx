import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { FontAwesome6, Ionicons } from "@expo/vector-icons";
import Carousel from "react-native-reanimated-carousel";
import { useAppTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateStory, useStoriesFeed, useStoriesStrip } from "@/entities/story";
import { useCreatePostComment, usePostComments, usePostsFeed, useReactToPost, type FeedPostItem } from "@/entities/post";
import { useProfile, usePublicProfiles } from "@/entities/user";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { getOptimizedImageUrl } from "@/shared/lib/imageUtils";
import { supabase } from "@/shared/api/supabase/client";
import { CommentsBottomSheet } from "@/shared/ui/comments-bottom-sheet/CommentsBottomSheet";
import { ShareBottomSheet } from "@/shared/ui/share-bottom-sheet/ShareBottomSheet";
import { ShimmerProvider } from "@/shared/ui/shimmer/ShimmerProvider";
import { ShimmerSurface } from "@/shared/ui/shimmer/ShimmerSurface";
import type { BrowseFlowParamList, FeedStackParamList } from "@/navigation/types";
import * as ImagePicker from "expo-image-picker";
import type { StoryGroup } from "@/types/stories";

const STORIES_BUCKET = "stories";

function bytesFromBase64(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function resolveStorageUrl(pathOrUrl: string, bucket: "avatars" | "business-cards" | "stories"): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return supabase.storage.from(bucket).getPublicUrl(pathOrUrl).data.publicUrl;
}

function formatRelativeTime(value: string): string {
  const createdAtMs = new Date(value).getTime();
  if (Number.isNaN(createdAtMs)) return "";
  const diffSeconds = Math.max(0, Math.floor((Date.now() - createdAtMs) / 1000));
  if (diffSeconds < 60) return `${diffSeconds} seconds ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hours ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} days ago`;
}

function profileName(first?: string | null, last?: string | null) {
  return `${first?.trim() ?? ""} ${last?.trim() ?? ""}`.trim() || "Unknown user";
}

function profileAvatar(pathOrUrl?: string | null) {
  if (!pathOrUrl?.trim()) return null;
  return resolveStorageUrl(pathOrUrl, "avatars");
}

function parseMediaUrls(raw?: string | null): string[] {
  const value = raw?.trim();
  if (!value) return [];
  if (value.startsWith("[")) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
      }
    } catch {
      return [];
    }
  }
  return [value];
}

function getPostImages(post: FeedPostItem) {
  const postMediaUrls = parseMediaUrls(post.media_url);
  return Array.from(new Set(postMediaUrls.map((url) => resolveStorageUrl(url, "stories"))));
}

export default function StoriesFeedScreen() {
  const { colors, isDark } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<BrowseFlowParamList>>();
  const route = useRoute<RouteProp<FeedStackParamList, "FeedMain">>();
  const { user } = useAuth();
  const { width, height } = useWindowDimensions();
  const { posts, isLoading } = usePostsFeed();
  const { data: storiesStrip = [] } = useStoriesStrip();
  const { stories: feedStories = [] } = useStoriesFeed();
  const createStory = useCreateStory();
  const reactToPost = useReactToPost();
  const { data: myProfile } = useProfile();
  const [slideIndexByPostId, setSlideIndexByPostId] = useState<Record<string, number>>({});
  const [expandedPostContentIds, setExpandedPostContentIds] = useState<Record<string, true>>({});
  const [isCommentsModalVisible, setIsCommentsModalVisible] = useState(false);
  const [expandedCommentIds, setExpandedCommentIds] = useState<Record<string, true>>({});
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [replyTargetCommentId, setReplyTargetCommentId] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState("");
  const createPostComment = useCreatePostComment();
  const [uploadingStory, setUploadingStory] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);
  const [shareSearch, setShareSearch] = useState("");
  const { data: shareUsers = [], isLoading: shareUsersLoading } = usePublicProfiles(shareSearch);
  const [likedPostIds, setLikedPostIds] = useState<Record<string, true>>({});
  const [likeCountByPostId, setLikeCountByPostId] = useState<Record<string, number>>({});

  const sliderHeight = Math.max(240, Math.min(360, Math.floor(height * 0.48)));
  const sortedPosts = useMemo(
    () => [...posts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [posts],
  );
  const focusPostId = route.params?.focusPostId?.trim() ?? "";
  const focusStoryId = route.params?.focusStoryId?.trim() ?? "";
  const focusedPosts = useMemo(() => {
    if (!focusPostId) return sortedPosts;
    const target = sortedPosts.find((post) => post.id === focusPostId);
    if (!target) return sortedPosts;
    return [target, ...sortedPosts.filter((post) => post.id !== focusPostId)];
  }, [focusPostId, sortedPosts]);
  const selectedPost = useMemo(
    () => focusedPosts.find((item) => item.id === selectedPostId) ?? null,
    [focusedPosts, selectedPostId],
  );
  const { data: postComments = [] } = usePostComments(selectedPostId ?? "");
  const topStories = useMemo(() => {
    if (!focusStoryId) return storiesStrip;
    const target = storiesStrip.find((story) => story.id === focusStoryId);
    if (!target) return storiesStrip;
    return [target, ...storiesStrip.filter((story) => story.id !== focusStoryId)];
  }, [focusStoryId, storiesStrip]);
  const storyGroups = useMemo<StoryGroup[]>(() => {
    const grouped = new Map<string, StoryGroup>();
    for (const story of feedStories) {
      const existing = grouped.get(story.user_id);
      if (existing) {
        existing.stories.push(story);
      } else {
        grouped.set(story.user_id, {
          user_id: story.user_id,
          profile: story.profile,
          stories: [story],
        });
      }
    }
    return Array.from(grouped.values());
  }, [feedStories]);
  const createStoryPlaceId = focusedPosts[0]?.place_id ?? sortedPosts[0]?.place_id ?? null;

  const toggleReplies = (commentId: string) => {
    setExpandedCommentIds((prev) => {
      if (prev[commentId]) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- remove expanded state for current comment
        const { [commentId]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [commentId]: true };
    });
  };

  const openComments = (postId: string) => {
    setSelectedPostId(postId);
    setReplyTargetCommentId(null);
    setExpandedCommentIds({});
    setIsCommentsModalVisible(true);
  };
  const canSendComment = commentInput.trim().length > 0 && !createPostComment.isPending;

  const uploadStoryPhoto = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!createStoryPlaceId) return;
    setUploadingStory(true);
    try {
      let fileBytes: ArrayBuffer | Uint8Array;
      if (asset.base64) {
        fileBytes = bytesFromBase64(asset.base64);
      } else {
        const response = await fetch(asset.uri);
        if (!response.ok) throw new Error(`Failed to read selected image (${response.status})`);
        fileBytes = await response.arrayBuffer();
      }
      const mimeType = asset.mimeType || "image/jpeg";
      const ext = asset.fileName?.split(".").pop()?.toLowerCase() ?? (mimeType === "image/png" ? "png" : "jpg");
      const path = `${user?.id ?? "anonymous"}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from(STORIES_BUCKET).upload(path, fileBytes, {
        upsert: true,
        contentType: mimeType,
      });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(STORIES_BUCKET).getPublicUrl(path);
      await createStory.mutateAsync({
        placeId: createStoryPlaceId,
        content: "New story",
        mediaUrl: data.publicUrl,
        expiryTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
    } finally {
      setUploadingStory(false);
    }
  };

  const pickStoryFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera access is required to take a photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.82,
      allowsEditing: true,
      base64: true,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (asset?.uri) await uploadStoryPhoto(asset);
  };

  const pickStoryFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Storage access is required to choose a photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.82,
      allowsEditing: true,
      base64: true,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (asset?.uri) await uploadStoryPhoto(asset);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={["top"]}>
        <View style={styles.root}>
          <ShimmerProvider active>
            <View style={styles.skeletonWrap}>
              {Array.from({ length: 2 }).map((_, idx) => (
                <View key={`post-skeleton-${idx}`} style={[styles.skeletonCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  <ShimmerSurface width={width - 24} height={Math.max(240, Math.min(360, Math.floor(height * 0.48)))} isDark={isDark} borderRadius={0} />
                  <View style={styles.skeletonActions}>
                    <ShimmerSurface width={58} height={18} borderRadius={9} isDark={isDark} />
                    <ShimmerSurface width={58} height={18} borderRadius={9} isDark={isDark} />
                  </View>
                  <ShimmerSurface width={180} height={14} borderRadius={7} isDark={isDark} />
                  <ShimmerSurface width={220} height={14} borderRadius={7} isDark={isDark} style={styles.skeletonLineGap} />
                </View>
              ))}
            </View>
          </ShimmerProvider>
        </View>
      </SafeAreaView>
    );
  }

  if (!focusedPosts.length) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={["top"]}>
        <View style={styles.centered}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No stories yet</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={["top"]}>
      <FlatList
        data={focusedPosts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.feedContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.storiesHeaderWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesHeaderContent}>
              <Pressable
                style={styles.storyBubble}
                disabled={!createStoryPlaceId || uploadingStory}
                onPress={() => {
                  if (!createStoryPlaceId) return;
                  Alert.alert("Add story", "Choose source", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Camera", onPress: () => void pickStoryFromCamera() },
                    { text: "Gallery", onPress: () => void pickStoryFromGallery() },
                  ]);
                }}
              >
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
                <Text style={[styles.storyBubbleName, { color: colors.text }]} numberOfLines={1}>
                  Add story
                </Text>
              </Pressable>
              {topStories.map((story) => {
                const name = profileName(story.profile?.first_name, story.profile?.last_name);
                const storyMedia = parseMediaUrls(story.media_url);
                const storyPreview = storyMedia[0] ? resolveStorageUrl(storyMedia[0], "stories") : null;
                const avatar = storyPreview ?? profileAvatar(story.profile?.avatar_url);
                const targetGroupIndex = storyGroups.findIndex((group) => group.user_id === story.user_id);
                return (
                  <Pressable
                    key={`story-bubble-${story.id}`}
                    style={styles.storyBubble}
                    onPress={() => {
                      if (targetGroupIndex < 0) return;
                      const group = storyGroups[targetGroupIndex];
                      const targetStoryIndex = Math.max(
                        0,
                        group.stories.findIndex((item) => item.id === story.id),
                      );
                      navigation.navigate("StoryViewer", {
                        groups: storyGroups,
                        initialGroupIndex: targetGroupIndex,
                        initialStoryIndex: targetStoryIndex,
                        placeId: group.stories[targetStoryIndex]?.place_id ?? "",
                      });
                    }}
                  >
                    <View style={[styles.storyBubbleRing, { borderColor: colors.primary }]}>
                      {avatar ? (
                        <SmartImage uri={avatar} style={styles.storyBubbleAvatar} contentFit="cover" />
                      ) : (
                        <View style={[styles.storyBubbleAvatar, { backgroundColor: colors.card }]} />
                      )}
                    </View>
                    <Text style={[styles.storyBubbleName, { color: colors.text }]} numberOfLines={1}>
                      {name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        }
        renderItem={({ item }) => {
          const postImagesRaw = getPostImages(item);
          const postImages = postImagesRaw.map((url) => getOptimizedImageUrl(url, 900, 560) || url);
          const slideIndex = slideIndexByPostId[item.id] ?? 0;
          const isContentExpanded = !!expandedPostContentIds[item.id];

          return (
            <View style={[styles.content, { backgroundColor: colors.background }]}>
              {postImages.length > 1 ? (
                <View>
                  <Carousel
                    width={width}
                    height={sliderHeight}
                    data={postImages}
                    loop={false}
                    onSnapToItem={(idx) => setSlideIndexByPostId((prev) => ({ ...prev, [item.id]: idx }))}
                    renderItem={({ item: imageUri, index }) => (
                      <SmartImage
                        uri={imageUri}
                        fallbackUri={postImagesRaw[index] ?? null}
                        recyclingKey={`${item.id}-feed-slider-${index}`}
                        style={[styles.sliderImage, { height: sliderHeight }]}
                        contentFit="cover"
                        transition={200}
                      />
                    )}
                  />
                  <View style={styles.sliderDots}>
                    {postImages.map((_, idx) => (
                      <View
                        key={`${item.id}-dot-${idx}`}
                        style={[
                          styles.sliderDot,
                          { backgroundColor: slideIndex === idx ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.45)" },
                        ]}
                      />
                    ))}
                  </View>
                </View>
              ) : postImages[0] ? (
                <SmartImage
                  uri={postImages[0]}
                  fallbackUri={postImagesRaw[0] ?? null}
                  recyclingKey={`${item.id}-feed-slider-single`}
                  style={[styles.sliderImage, { height: sliderHeight }]}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <View style={[styles.sliderFallback, { height: sliderHeight, backgroundColor: colors.card }]}>
                  <Ionicons name="image-outline" size={30} color={colors.textMuted} />
                </View>
              )}

              <View style={styles.actionsSection}>
                <View style={styles.leftActions}>
                  <Pressable
                    style={styles.actionBtn}
                    onPress={() => {
                      const wasLiked = !!likedPostIds[item.id];
                      setLikedPostIds((prev) => {
                        if (wasLiked) {
                          const { [item.id]: _removed, ...rest } = prev;
                          return rest;
                        }
                        return { ...prev, [item.id]: true };
                      });
                      setLikeCountByPostId((prev) => ({
                        ...prev,
                        [item.id]: Math.max(0, (prev[item.id] ?? item.reaction_count) + (wasLiked ? -1 : 1)),
                      }));
                      void reactToPost.mutateAsync({ postId: item.id, type: "like" }).catch(() => {
                        setLikedPostIds((prev) => {
                          if (wasLiked) return { ...prev, [item.id]: true };
                          const { [item.id]: _removed, ...rest } = prev;
                          return rest;
                        });
                        setLikeCountByPostId((prev) => ({
                          ...prev,
                          [item.id]: Math.max(0, (prev[item.id] ?? item.reaction_count) + (wasLiked ? 1 : -1)),
                        }));
                      });
                    }}
                  >
                    <Ionicons name={likedPostIds[item.id] ? "heart" : "heart-outline"} size={24} color={colors.text} />
                    <Text style={[styles.actionCount, { color: colors.text }]}>
                      {likeCountByPostId[item.id] ?? item.reaction_count}
                    </Text>
                  </Pressable>
                  <Pressable style={styles.actionBtn} onPress={() => openComments(item.id)}>
                    <Ionicons name="chatbubble-outline" size={23} color={colors.text} />
                    <Text style={[styles.actionCount, { color: colors.text }]}>{item.comment_count}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.bookBtn, { backgroundColor: "#ec6544" }]}
                    onPress={() => navigation.navigate("BookingFlow", { id: item.place_id })}
                  >
                    <Ionicons name="calendar-outline" size={14} color="#fff" />
                    <Text style={[styles.bookBtnText, { color: "#fff" }]}>Book</Text>
                  </Pressable>
                </View>
                <Pressable style={styles.shareBtn} onPress={() => setShareVisible(true)}>
                  <FontAwesome6 name="share" size={20} color={colors.text} />
                </Pressable>
              </View>

              <View style={styles.commentsSection}>
                <Pressable
                  onPress={() => {
                    setExpandedPostContentIds((prev) => {
                      if (prev[item.id]) {
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- remove expanded state for current story
                        const { [item.id]: _removed, ...rest } = prev;
                        return rest;
                      }
                      return { ...prev, [item.id]: true };
                    });
                  }}
                >
                  <Text style={[styles.storyText, { color: colors.text }]} numberOfLines={isContentExpanded ? undefined : 2}>
                    {item.content}
                  </Text>
                </Pressable>
                <Text style={[styles.publishedAtText, { color: colors.textMuted }]}>{formatRelativeTime(item.created_at)}</Text>
                {item.comment_preview.slice(0, 2).map((comment) => (
                  <Text key={comment.id} style={[styles.commentText, { color: colors.text }]} numberOfLines={1}>
                    {comment.content}
                  </Text>
                ))}
              </View>

              <View style={[styles.authorSection, { borderTopColor: colors.border }]}>
                <View style={styles.authorInfo}>
                  {profileAvatar(item.profile?.avatar_url) ? (
                    <SmartImage uri={profileAvatar(item.profile?.avatar_url)} style={styles.avatarImage} contentFit="cover" />
                  ) : (
                    <View style={[styles.avatarPlaceholder, { backgroundColor: colors.card }]}>
                      <Ionicons name="person-outline" size={18} color={colors.text} />
                    </View>
                  )}
                  <Text style={[styles.authorName, { color: colors.text }]}>
                    {profileName(item.profile?.first_name, item.profile?.last_name)}
                  </Text>
                </View>
                <Pressable style={[styles.followBtn, { borderColor: colors.border }]}>
                  <Text style={[styles.followText, { color: colors.text }]}>Follow</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />

      <CommentsBottomSheet
        visible={isCommentsModalVisible}
        onClose={() => {
          setIsCommentsModalVisible(false);
          setReplyTargetCommentId(null);
          setCommentInput("");
        }}
        comments={postComments}
        hasSelectedPost={!!selectedPost}
        expandedCommentIds={expandedCommentIds}
        replyTargetCommentId={replyTargetCommentId}
        commentInput={commentInput}
        canSendComment={canSendComment}
        submittingComment={createPostComment.isPending}
        currentUserAvatarUrl={profileAvatar(myProfile?.avatar_url)}
        resolveAvatarUri={profileAvatar}
        formatRelativeTime={formatRelativeTime}
        onToggleReplies={toggleReplies}
        onReplyPress={setReplyTargetCommentId}
        onCancelReply={() => setReplyTargetCommentId(null)}
        onChangeCommentInput={setCommentInput}
        onSubmitComment={() => {
          if (!canSendComment || !selectedPost) return;
          void createPostComment.mutateAsync({
            postId: selectedPost.id,
            parentCommentId: replyTargetCommentId,
            content: commentInput,
          });
          setCommentInput("");
          setReplyTargetCommentId(null);
        }}
      />

      <ShareBottomSheet
        visible={shareVisible}
        onClose={() => setShareVisible(false)}
        users={shareUsers}
        loading={shareUsersLoading}
        searchValue={shareSearch}
        onChangeSearch={setShareSearch}
        resolveAvatarUri={profileAvatar}
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
  skeletonWrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 10,
  },
  skeletonCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    overflow: "hidden",
    paddingBottom: 12,
    gap: 10,
  },
  skeletonActions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 12,
  },
  skeletonLineGap: {
    marginTop: -4,
    marginLeft: 12,
  },
  emptyText: {
    fontSize: 14,
  },
  feedContent: {
    paddingBottom: 12,
    gap: 8,
  },
  storiesHeaderWrap: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  storiesHeaderContent: {
    paddingHorizontal: 12,
    gap: 12,
  },
  storyBubble: {
    width: 72,
    alignItems: "center",
    gap: 6,
  },
  storyBubbleRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  storyBubbleAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  storyPlusBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  storyBubbleName: {
    fontSize: 12,
    textAlign: "center",
  },
  content: {
    paddingBottom: 8,
  },
  sliderImage: {
    width: "100%",
  },
  sliderFallback: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  sliderDots: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 10,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  sliderDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  actionsSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  leftActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bookBtn: {
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: 14,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  bookBtnText: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 16,
  },
  actionCount: {
    fontSize: 16,
    fontWeight: "700",
  },
  shareBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  commentsSection: {
    paddingHorizontal: 14,
    paddingTop: 8,
    gap: 6,
  },
  storyText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "500",
  },
  publishedAtText: {
    fontSize: 12,
    lineHeight: 16,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 19,
  },
  authorSection: {
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  authorInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  authorName: {
    fontSize: 15,
    fontWeight: "700",
  },
  followBtn: {
    minWidth: 86,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
  },
  followText: {
    fontSize: 14,
    fontWeight: "700",
  },
  commentsModalContent: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  modalCommentCard: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    gap: 8,
  },
  commentAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  commentAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  commentAuthorName: {
    fontSize: 13,
    fontWeight: "700",
  },
  modalCommentText: {
    fontSize: 14,
    lineHeight: 20,
  },
  modalCommentMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  commentMetaActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modalCommentTime: {
    fontSize: 12,
    fontWeight: "500",
  },
  replyToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  replyToggleText: {
    fontSize: 12,
    fontWeight: "600",
  },
  replyRow: {
    marginLeft: 10,
    paddingLeft: 10,
    borderLeftWidth: 1,
    borderLeftColor: "rgba(127,127,127,0.35)",
    gap: 4,
  },
  replyAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  replyAuthorName: {
    fontSize: 12,
    fontWeight: "700",
  },
  replyText: {
    fontSize: 13,
    lineHeight: 18,
  },
  replyTime: {
    fontSize: 11,
    fontWeight: "500",
  },
  noCommentsText: {
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 20,
  },
  replyComposerWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
    paddingTop: 8,
    paddingBottom: 8,
  },
  commentComposerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  commentComposerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  commentComposerInputWrap: {
    flex: 1,
    position: "relative",
  },
  commentComposerTextareaContainer: {
    width: "100%",
  },
  commentComposerTextarea: {
    minHeight: 100,
    maxHeight: 300,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingRight: 44,
    fontSize: 14,
  },
  commentComposerSendBtn: {
    position: "absolute",
    right: 10,
    bottom: 10,
  },
  replyComposerCancel: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "700",
    alignSelf: "flex-start",
  },
});
