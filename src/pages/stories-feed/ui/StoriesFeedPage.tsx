import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Easing, FlatList, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { FontAwesome6, Ionicons } from "@expo/vector-icons";
import Carousel from "react-native-reanimated-carousel";
import Reanimated, { Easing as ReanimatedEasing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useAppTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateStory, useStoriesFeed, useStoriesStrip } from "@/entities/story";
import {
  useCreatePost,
  useCreatePostComment,
  usePostComments,
  usePostsFeed,
  useReactToPost,
  type FeedPostItem,
} from "@/entities/post";
import { useMyFollowing, useProfile, usePublicProfiles, useToggleFollow } from "@/entities/user";
import { useBusinessCards } from "@/entities/business-card";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { getOptimizedImageUrl } from "@/shared/lib/imageUtils";
import { supabase } from "@/shared/api/supabase/client";
import { BottomSheetPickerModal } from "@/shared/ui/bottom-sheet-picker/BottomSheetPickerModal";
import { CommentComposer } from "@/shared/ui/comment-composer/CommentComposer";
import { CommentsBottomSheet } from "@/shared/ui/comments-bottom-sheet/CommentsBottomSheet";
import { ShareBottomSheet } from "@/shared/ui/share-bottom-sheet/ShareBottomSheet";
import { ShimmerProvider } from "@/shared/ui/shimmer/ShimmerProvider";
import { ShimmerSurface } from "@/shared/ui/shimmer/ShimmerSurface";
import { AppHeader } from "@/shared/ui/app-header/AppHeader";
import { StorySourcePickerModal, type StorySourceOption } from "@/shared/ui/story-source-picker/StorySourcePickerModal";
import type { BrowseFlowParamList, FeedStackParamList, RootTabParamList } from "@/navigation/types";
import * as ImagePicker from "expo-image-picker";
import type { StoryGroup } from "@/types/stories";
import Toast from "react-native-toast-message";

const STORIES_BUCKET = "stories";
const MAX_POST_PHOTOS = 8;

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

function PostSlideProgressSegment({
  index,
  count,
  activeIndex,
  activeProgress,
}: {
  index: number;
  count: number;
  activeIndex: Reanimated.SharedValue<number>;
  activeProgress: Reanimated.SharedValue<number>;
}) {
  const fillStyle = useAnimatedStyle(() => {
    if (count <= 0) return { width: "0%" };
    const currentIndex = activeIndex.value;
    let width = 0;
    if (index < currentIndex) width = 100;
    else if (index === currentIndex) width = activeProgress.value * 100;
    return { width: `${Math.min(100, Math.max(0, width))}%` };
  }, [activeIndex, activeProgress, count, index]);

  return (
    <View style={styles.sliderProgressTrack}>
      <Reanimated.View style={[styles.sliderProgressFill, fillStyle]} />
    </View>
  );
}

const PostMediaCarousel = memo(function PostMediaCarousel({
  postId,
  postImages,
  postImagesRaw,
  width,
  sliderHeight,
}: {
  postId: string;
  postImages: string[];
  postImagesRaw: string[];
  width: number;
  sliderHeight: number;
}) {
  const activeIndexShared = useSharedValue(0);
  const activeProgressShared = useSharedValue(0);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    activeProgressShared.value = 0;
    activeProgressShared.value = withTiming(1, {
      duration: 3000,
      easing: ReanimatedEasing.linear,
    });
  }, [activeProgressShared]);

  return (
    <View>
      <Carousel
        width={width}
        height={sliderHeight}
        data={postImages}
        loop
        autoPlay
        autoPlayInterval={3000}
        scrollAnimationDuration={650}
        onSnapToItem={(idx) => {
          setActiveIndex(idx);
          activeIndexShared.value = idx;
          activeProgressShared.value = 0;
          activeProgressShared.value = withTiming(1, {
            duration: 3000,
            easing: ReanimatedEasing.linear,
          });
        }}
        renderItem={({ item: imageUri, index }) => (
          <SmartImage
            uri={imageUri}
            fallbackUri={postImagesRaw[index] ?? null}
            recyclingKey={`${postId}-feed-slider-${index}`}
            style={[styles.sliderImage, { height: sliderHeight }]}
            contentFit="cover"
            transition={200}
          />
        )}
      />
      <View style={styles.sliderProgressWrap}>
        {postImages.map((_, idx) => (
          <PostSlideProgressSegment
            key={`${postId}-slide-progress-track-${idx}`}
            index={idx}
            count={postImages.length}
            activeIndex={activeIndexShared}
            activeProgress={activeProgressShared}
          />
        ))}
      </View>
      <View style={styles.sliderDots}>
        {postImages.map((_, idx) => (
          <View
            key={`${postId}-dot-${idx}`}
            style={[
              styles.sliderDot,
              { backgroundColor: activeIndex === idx ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.45)" },
            ]}
          />
        ))}
      </View>
    </View>
  );
});

export default function StoriesFeedScreen() {
  const { colors, isDark, mode, setMode } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<BrowseFlowParamList>>();
  const rootNavigation = useNavigation<NavigationProp<RootTabParamList>>();
  const route = useRoute<RouteProp<FeedStackParamList, "FeedMain">>();
  const { user } = useAuth();
  const { width, height } = useWindowDimensions();
  const { posts, isLoading } = usePostsFeed();
  const { data: storiesStrip = [] } = useStoriesStrip();
  const { stories: feedStories = [] } = useStoriesFeed();
  const createStory = useCreateStory();
  const createPost = useCreatePost();
  const reactToPost = useReactToPost();
  const { followingSet } = useMyFollowing();
  const toggleFollow = useToggleFollow();
  const { data: myProfile } = useProfile();
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
  const { data: businessCards = [] } = useBusinessCards();
  const [likedPostIds, setLikedPostIds] = useState<Record<string, true>>({});
  const [likeCountByPostId, setLikeCountByPostId] = useState<Record<string, number>>({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createStep, setCreateStep] = useState<"menu" | "post">("menu");
  const [storySourceModalVisible, setStorySourceModalVisible] = useState(false);
  const [postInput, setPostInput] = useState("");
  const [postInputError, setPostInputError] = useState(false);
  const [selectedPostPlaceId, setSelectedPostPlaceId] = useState<string | null>(null);
  const [postPlaceError, setPostPlaceError] = useState(false);
  const [postPhotos, setPostPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [uploadingPostPhotos, setUploadingPostPhotos] = useState(false);
  const [postSubmitStage, setPostSubmitStage] = useState<"uploading_photos" | "creating_post" | null>(null);
  const [followOverrides, setFollowOverrides] = useState<Record<string, boolean>>({});
  const createStepFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!createModalVisible) return;
    createStepFade.setValue(0);
    Animated.timing(createStepFade, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [createModalVisible, createStep, createStepFade]);

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
  const currentUserAvatarUrl = useMemo(() => {
    const metadataAvatar =
      typeof user?.user_metadata === "object" && user?.user_metadata && "avatar_url" in user.user_metadata
        ? String((user.user_metadata as Record<string, unknown>).avatar_url ?? "")
        : "";
    return profileAvatar(myProfile?.avatar_url) ?? profileAvatar(metadataAvatar);
  }, [myProfile?.avatar_url, user?.user_metadata]);
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
  const createStoryPlaceId = focusedPosts[0]?.place_id ?? sortedPosts[0]?.place_id ?? businessCards[0]?.id ?? null;
  const postPlaceCards = useMemo(
    () =>
      businessCards
        .map((card) => ({
          id: card.id,
          name: card.name?.trim() || "Unknown place",
          address: card.address?.trim() || "Address unavailable",
          rating: card.rating,
          imageUrl: card.images.at(-1)?.trim() ? resolveStorageUrl(card.images.at(-1) as string, "business-cards") : null,
        }))
        .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index),
    [businessCards],
  );

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

  const redirectToAuth = () => {
    rootNavigation.navigate("Profile", { screen: "Auth" });
  };

  const runAuthedAction = (action: () => void) => {
    if (!user) {
      redirectToAuth();
      return;
    }
    action();
  };
  const toggleThemeMode = () => {
    setMode(mode === "dark" ? "light" : "dark");
  };

  const openComments = (postId: string) => {
    runAuthedAction(() => {
      setSelectedPostId(postId);
      setReplyTargetCommentId(null);
      setExpandedCommentIds({});
      setIsCommentsModalVisible(true);
    });
  };

  const onToggleFollowAuthor = (authorId: string, displayName: string) => {
    const isFollowing = followOverrides[authorId] ?? followingSet.has(authorId);
    setFollowOverrides((prev) => ({ ...prev, [authorId]: !isFollowing }));
    void toggleFollow
      .mutateAsync({ followingId: authorId, isFollowing })
      .then((result) => {
        if (result.skipped) return;
        Toast.show({
          type: "success",
          text1: result.nowFollowing ? "Added to followers" : "Removed from followers",
          text2: displayName,
        });
      })
      .catch((error) => {
        setFollowOverrides((prev) => ({ ...prev, [authorId]: isFollowing }));
        Toast.show({
          type: "error",
          text1: "Follow action failed",
          text2: error instanceof Error ? error.message : "Please try again.",
        });
      });
  };
  const canSendComment = commentInput.trim().length > 0 && !createPostComment.isPending;

  const uploadStoryPhotos = async (assets: ImagePicker.ImagePickerAsset[]) => {
    if (!createStoryPlaceId) return;
    setUploadingStory(true);
    try {
      const uploadedUrls: string[] = [];
      for (const asset of assets) {
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
        const path = `${user?.id ?? "anonymous"}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from(STORIES_BUCKET).upload(path, fileBytes, {
          upsert: true,
          contentType: mimeType,
        });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from(STORIES_BUCKET).getPublicUrl(path);
        uploadedUrls.push(data.publicUrl);
      }
      if (!uploadedUrls.length) return;
      await createStory.mutateAsync({
        placeId: createStoryPlaceId,
        content: "New story",
        mediaUrl: JSON.stringify(uploadedUrls),
        expiryTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
    } catch (error) {
      Alert.alert("Story failed", error instanceof Error ? error.message : "Could not upload story.");
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
    if (asset?.uri) await uploadStoryPhotos([asset]);
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
      allowsEditing: false,
      allowsMultipleSelection: true,
      selectionLimit: 0,
      base64: true,
    });
    if (!result.canceled && result.assets.length > 0) {
      await uploadStoryPhotos(result.assets);
    }
  };

  const onChooseStorySource = (source: StorySourceOption) => {
    setStorySourceModalVisible(false);
    if (source === "camera") {
      void pickStoryFromCamera();
      return;
    }
    void pickStoryFromGallery();
  };

  const submitPost = async () => {
    const targetPlaceId = selectedPostPlaceId;
    const content = postInput.trim();
    if (!targetPlaceId) {
      setPostPlaceError(true);
      return;
    }
    if (!content) {
      setPostInputError(true);
      return;
    }
    if (createPost.isPending || uploadingPostPhotos) return;
    try {
      setUploadingPostPhotos(true);
      setPostSubmitStage("uploading_photos");
      const uploadedUrls: string[] = [];
      for (let idx = 0; idx < postPhotos.length; idx += 1) {
        const asset = postPhotos[idx];
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
        const path = `${user?.id ?? "anonymous"}/post-${Date.now()}-${idx}.${ext}`;
        const { error: uploadError } = await supabase.storage.from(STORIES_BUCKET).upload(path, fileBytes, {
          upsert: true,
          contentType: mimeType,
        });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from(STORIES_BUCKET).getPublicUrl(path);
        uploadedUrls.push(data.publicUrl);
      }
      setPostSubmitStage("creating_post");
      const created = (await createPost.mutateAsync({
        placeId: targetPlaceId,
        content,
        mediaUrl: uploadedUrls.length ? JSON.stringify(uploadedUrls) : null,
      })) as unknown as { id: string | number };
      setCreateModalVisible(false);
      setCreateStep("menu");
      setPostInput("");
      setPostInputError(false);
      setSelectedPostPlaceId(null);
      setPostPlaceError(false);
      setPostPhotos([]);
      setPostSubmitStage(null);
      rootNavigation.navigate("Feed", { screen: "FeedMain", params: { focusPostId: String(created.id) } });
    } catch (error) {
      Alert.alert("Post failed", error instanceof Error ? error.message : "Could not publish post.");
    } finally {
      setUploadingPostPhotos(false);
      setPostSubmitStage(null);
    }
  };

  const pickPostPhotos = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Storage access is required to choose photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.82,
      allowsMultipleSelection: true,
      selectionLimit: MAX_POST_PHOTOS,
      base64: true,
    });
    if (result.canceled) return;
    setPostPhotos((prev) => {
      const merged = [...prev, ...result.assets];
      const dedup = merged.filter((asset, index, all) => all.findIndex((candidate) => candidate.uri === asset.uri) === index);
      return dedup.slice(0, MAX_POST_PHOTOS);
    });
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

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={[]}>
      <AppHeader
        title="Feed"
        leftIcon="add"
        onLeftPress={() =>
          runAuthedAction(() => {
            setCreateStep("menu");
            setCreateModalVisible(true);
          })
        }
        rightIcon={isDark ? "sunny-outline" : "moon-outline"}
        onRightPress={toggleThemeMode}
      />
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
                disabled={uploadingStory}
                onPress={() => {
                  runAuthedAction(() => {
                    if (!createStoryPlaceId) {
                      navigation.navigate("Profile", { screen: "ProfileMain", params: { openCreateStep: "story" } });
                      return;
                    }
                    setStorySourceModalVisible(true);
                  });
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
          const isContentExpanded = !!expandedPostContentIds[item.id];

          return (
            <View style={[styles.content, { backgroundColor: colors.background }]}>
              {postImages.length > 1 ? (
                <PostMediaCarousel
                  postId={item.id}
                  postImages={postImages}
                  postImagesRaw={postImagesRaw}
                  width={width}
                  sliderHeight={sliderHeight}
                />
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
                      runAuthedAction(() => {
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
                    onPress={() =>
                      runAuthedAction(() => {
                        navigation.navigate("BookingFlow", { id: item.place_id });
                      })
                    }
                  >
                    <Ionicons name="calendar-outline" size={14} color="#fff" />
                    <Text style={[styles.bookBtnText, { color: "#fff" }]}>Book</Text>
                  </Pressable>
                </View>
                <Pressable style={styles.shareBtn} onPress={() => runAuthedAction(() => setShareVisible(true))}>
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
                  <View style={styles.authorNameRow}>
                    <Text style={[styles.authorName, { color: colors.text }]}>
                      {profileName(item.profile?.first_name, item.profile?.last_name)}
                    </Text>
                    {item.profile?.is_verified ? <Ionicons name="checkmark-circle" size={14} color={colors.primary} /> : null}
                  </View>
                </View>
                {item.user_id !== user?.id ? (
                  <Pressable
                    style={[
                      styles.followBtn,
                      {
                        borderColor: (followOverrides[item.user_id] ?? followingSet.has(item.user_id)) ? "#ec6544" : colors.border,
                        backgroundColor: (followOverrides[item.user_id] ?? followingSet.has(item.user_id))
                          ? "rgba(236,101,68,0.14)"
                          : colors.background,
                      },
                    ]}
                    onPress={() =>
                      runAuthedAction(() =>
                        onToggleFollowAuthor(item.user_id, profileName(item.profile?.first_name, item.profile?.last_name)),
                      )
                    }
                    disabled={toggleFollow.isPending}
                  >
                    <Text
                      style={[
                        styles.followText,
                        { color: (followOverrides[item.user_id] ?? followingSet.has(item.user_id)) ? "#ec6544" : colors.text },
                      ]}
                    >
                      {(followOverrides[item.user_id] ?? followingSet.has(item.user_id)) ? "Following" : "Follow"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No posts yet</Text>
          </View>
        }
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
        currentUserAvatarUrl={currentUserAvatarUrl}
        resolveAvatarUri={profileAvatar}
        formatRelativeTime={formatRelativeTime}
        onToggleReplies={toggleReplies}
        onReplyPress={(commentId) => {
          runAuthedAction(() => setReplyTargetCommentId(commentId));
        }}
        onCancelReply={() => setReplyTargetCommentId(null)}
        onChangeCommentInput={setCommentInput}
        onSubmitComment={() => {
          runAuthedAction(() => {
            if (!canSendComment || !selectedPost) return;
            void createPostComment.mutateAsync({
              postId: selectedPost.id,
              parentCommentId: replyTargetCommentId,
              content: commentInput,
            });
            setCommentInput("");
            setReplyTargetCommentId(null);
          });
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
      <BottomSheetPickerModal
        visible={createModalVisible}
        onClose={() => {
          setCreateModalVisible(false);
          setCreateStep("menu");
          setPostInput("");
          setPostInputError(false);
          setSelectedPostPlaceId(null);
          setPostPlaceError(false);
          setPostPhotos([]);
          setPostSubmitStage(null);
        }}
        title={createStep === "menu" ? "Create" : "Create post"}
        maxHeightFraction={0.82}
      >
        <Animated.View style={[styles.createStepBody, { opacity: createStepFade }]}>
          {createStep === "menu" ? (
            <View style={styles.createMenuBody}>
              <View style={styles.createOptionGrid}>
                <Pressable
                  style={[styles.createOptionCard, { borderColor: colors.border, backgroundColor: colors.background }]}
                  onPress={() => setCreateStep("post")}
                >
                  <Ionicons name="grid-outline" size={34} color={colors.text} />
                  <Text style={[styles.createOptionLabel, { color: colors.text }]}>Post</Text>
                  <Text style={[styles.createOptionHint, { color: colors.textMuted }]}>Create a new post</Text>
                </Pressable>
                <Pressable
                  style={[styles.createOptionCard, { borderColor: colors.border, backgroundColor: colors.background }]}
                  onPress={() => {
                    setCreateModalVisible(false);
                    if (!createStoryPlaceId) {
                      Alert.alert("Place is required", "Please add or select a place first.");
                      return;
                    }
                    setStorySourceModalVisible(true);
                  }}
                >
                  <Ionicons name="add-circle-outline" size={34} color={colors.text} />
                  <Text style={[styles.createOptionLabel, { color: colors.text }]}>Story</Text>
                  <Text style={[styles.createOptionHint, { color: colors.textMuted }]}>Share a quick story</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.createPostModalBody}>
          {postSubmitStage ? (
            <View style={styles.createPostLoadingOnlyWrap}>
              <View style={styles.createPostLoadingWrap}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.createPostLoadingText, { color: colors.textMuted }]}>
                  {postSubmitStage === "uploading_photos" ? "Uploading photos..." : "Creating post..."}
                </Text>
              </View>
            </View>
          ) : null}
          {!postSubmitStage ? (
            <>
          <Pressable style={[styles.postUploaderBox, { borderColor: colors.border }]} onPress={() => void pickPostPhotos()}>
            <Ionicons name="images-outline" size={22} color={colors.textMuted} />
            <Text style={[styles.postUploaderText, { color: colors.textMuted }]}>Tap to add photos</Text>
            <Text style={[styles.postPhotoCount, { color: colors.textMuted }]}>
              {postPhotos.length ? `${postPhotos.length}/${MAX_POST_PHOTOS} selected` : `Up to ${MAX_POST_PHOTOS} photos`}
            </Text>
          </Pressable>
          {postPhotos.length ? (
            <View style={styles.postPhotosList}>
              {postPhotos.map((photo) => (
                <View key={photo.uri} style={styles.postPhotoItem}>
                  <SmartImage uri={photo.uri} style={styles.postPhotoThumb} contentFit="cover" />
                  <Pressable
                    style={[styles.postPhotoRemoveBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => {
                      setPostPhotos((prev) => prev.filter((item) => item.uri !== photo.uri));
                    }}
                  >
                    <Ionicons name="close" size={11} color={colors.text} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
          <Text style={[styles.postRequiredHint, { color: colors.textMuted }]}>Required: place and post text.</Text>
          <Text style={[styles.postPlacesLabel, { color: colors.textMuted }]}>Tell us where have you been</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.postPlacesRow}
          >
            {postPlaceCards.length ? (
              postPlaceCards.map((place) => {
                const isSelected = selectedPostPlaceId === place.id;
                return (
                  <Pressable
                    key={`feed-post-place-card-${place.id}`}
                    style={[
                      styles.postPlaceCard,
                      {
                        borderColor: isSelected ? "#ec6544" : postPlaceError ? colors.danger : colors.border,
                        backgroundColor: colors.card,
                      },
                    ]}
                    onPress={() => {
                      setSelectedPostPlaceId((prev) => (prev === place.id ? null : place.id));
                      setPostPlaceError(false);
                    }}
                  >
                    <View style={styles.postPlaceImageWrap}>
                      {place.imageUrl ? (
                        <SmartImage uri={place.imageUrl} style={styles.postPlaceImage} contentFit="cover" />
                      ) : (
                        <View style={[styles.postPlaceImage, styles.postPlaceImageFallback, { backgroundColor: colors.background }]}>
                          <Ionicons name="image-outline" size={18} color={colors.textMuted} />
                        </View>
                      )}
                      <View style={[styles.postPlaceRatingBadge, { backgroundColor: "rgba(0,0,0,0.75)" }]}>
                        <Ionicons name="star" size={10} color="#fbbf24" />
                        <Text style={styles.postPlaceRatingText}>{Number.isFinite(place.rating) ? place.rating.toFixed(1) : "-"}</Text>
                      </View>
                    </View>
                    <Text style={[styles.postPlaceCardTitle, { color: colors.text }]} numberOfLines={1}>
                      {place.name}
                    </Text>
                    <Text style={[styles.postPlaceCardAddress, { color: colors.textMuted }]} numberOfLines={2}>
                      {place.address}
                    </Text>
                  </Pressable>
                );
              })
            ) : (
              <View style={[styles.postPlaceEmptyCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <Text style={[styles.modalNoPlacesText, { color: colors.textMuted }]}>No places available</Text>
              </View>
            )}
          </ScrollView>
          <CommentComposer
            avatarUrl={currentUserAvatarUrl}
            value={postInput}
            onChangeText={(value) => {
              setPostInput(value);
              if (postInputError && value.trim()) setPostInputError(false);
            }}
            placeholder="Share an update..."
            canSend={!createPost.isPending && !uploadingPostPhotos}
            sending={createPost.isPending || uploadingPostPhotos}
            onSend={() => void submitPost()}
            minHeight={120}
            maxHeight={220}
            hasError={postInputError}
          />
          <View style={styles.createPostBackRow}>
            <Pressable
              style={[styles.createFlowBackBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={() => setCreateStep("menu")}
            >
              <Text style={[styles.createFlowBackBtnText, { color: colors.textMuted }]}>Back to create options</Text>
            </Pressable>
          </View>
            </>
          ) : null}
            </View>
          )}
        </Animated.View>
      </BottomSheetPickerModal>
      <StorySourcePickerModal
        visible={storySourceModalVisible}
        onClose={() => setStorySourceModalVisible(false)}
        onChoose={onChooseStorySource}
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
  sliderProgressWrap: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    flexDirection: "row",
    gap: 4,
  },
  sliderProgressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.35)",
    overflow: "hidden",
  },
  sliderProgressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#fff",
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
  authorNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
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
  createMenuBody: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  createStepBody: {
    flex: 1,
  },
  createOptionGrid: {
    flexDirection: "row",
    gap: 10,
  },
  createOptionCard: {
    flex: 1,
    minHeight: 124,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 14,
    gap: 12,
  },
  createOptionLabel: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  createOptionHint: {
    fontSize: 14,
    textAlign: "center",
  },
  createPostModalBody: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
    minHeight: 420,
  },
  postUploaderBox: {
    marginTop: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 14,
    minHeight: 86,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  postUploaderText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  postPhotoCount: {
    fontSize: 12,
  },
  postRequiredHint: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "600",
  },
  postPlacesLabel: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "600",
  },
  postPlacesRow: {
    gap: 10,
    paddingRight: 8,
  },
  postPlaceCard: {
    width: 158,
    borderWidth: 1,
    borderRadius: 14,
    padding: 8,
    gap: 6,
  },
  postPlaceImageWrap: {
    position: "relative",
  },
  postPlaceImage: {
    width: "100%",
    height: 84,
    borderRadius: 10,
  },
  postPlaceImageFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  postPlaceRatingBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    minHeight: 20,
    paddingHorizontal: 6,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  postPlaceRatingText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  postPlaceCardTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  postPlaceCardAddress: {
    fontSize: 12,
    lineHeight: 16,
  },
  postPlaceEmptyCard: {
    width: 220,
    minHeight: 84,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  postPhotosList: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  postPhotoItem: {
    position: "relative",
    width: 56,
    height: 56,
  },
  postPhotoThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
  postPhotoRemoveBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  modalNoPlacesText: {
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 8,
  },
  createPostBackRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  createPostLoadingOnlyWrap: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  createPostLoadingWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 24,
  },
  createPostLoadingText: {
    fontSize: 13,
    fontWeight: "600",
  },
  createFlowBackBtn: {
    minHeight: 48,
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    flex: 1,
  },
  createFlowBackBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
