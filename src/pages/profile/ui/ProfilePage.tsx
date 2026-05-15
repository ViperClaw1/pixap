import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Linking, Platform, Alert } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { CompositeNavigationProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/app/providers/AuthProvider";
import { useProfile } from "@/entities/user";
import { useUserRole } from "@/entities/user";
import { useProfileSocialMetrics, useSuggestedProfiles, useToggleFollow } from "@/entities/user";
import { useBusinessCards } from "@/entities/business-card";
import { useUnreadCount } from "@/entities/notification";
import { useFavorites } from "@/entities/favorite";
import { useBookings } from "@/entities/booking";
import { useCreatePost } from "@/entities/post";
import { useCreateStory } from "@/entities/story";
import type { ProfileStackParamList, RootTabParamList } from "@/app/navigation/types";
import { StoriesArchiveView } from "@/widgets/stories-archive";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { getOptimizedImageUrl } from "@/shared/lib/imageUtils";
import { useEntitlement } from "@/entities/subscription";
import { BottomSheetPickerModal } from "@/shared/ui/bottom-sheet-picker/BottomSheetPickerModal";
import { CommentComposer } from "@/shared/ui/comment-composer/CommentComposer";
import { AppHeader } from "@/shared/ui/app-header/AppHeader";
import { NotificationsSheetModal } from "@/shared/ui/notifications-sheet";
import { supabase } from "@/shared/api/supabase/client";
import { primaryPressableStyle, primaryPressableTextStyle } from "@/shared/theme/primaryPressable";
import type { ThemeMode } from "@/app/providers/ThemeProvider";
import {
  APPLE_SUBSCRIPTION_URL,
  GOOGLE_SUBSCRIPTION_URL,
  MAX_POST_PHOTOS,
  PRIVACY_URL,
  STORIES_BUCKET,
} from "../model/constants";
import {
  POST_STORAGE_MAX_LONG_EDGE,
  STORY_STORAGE_MAX_LONG_EDGE,
  prepareImageForStorageUpload,
} from "@/shared/lib/prepareImageForStorageUpload";
import { formatErrorForAlert } from "@/shared/lib/formatErrorForAlert";
import { profileFullName } from "../model/format";

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<ProfileStackParamList, "ProfileMain">,
  BottomTabNavigationProp<RootTabParamList>
>;
type ActionItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  badgeCount?: number;
};

function ProfileScreenContent() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<ProfileStackParamList, "ProfileMain">>();
  const insets = useSafeAreaInsets();
  const { colors, mode, setMode } = useAppTheme();
  const { user, loading, signOut } = useAuth();
  const { data: profile } = useProfile();
  const unreadNotifications = useUnreadCount();
  const { data: favorites = [] } = useFavorites();
  const { data: bookings = [] } = useBookings();
  const { data: businessCards = [] } = useBusinessCards();
  const { role } = useUserRole();
  const { postsCount, followersCount, followingCount } = useProfileSocialMetrics();
  const { suggestions } = useSuggestedProfiles(12);
  const toggleFollow = useToggleFollow();
  const { status: subscriptionStatus, isTrial, expiresAt, isActive } = useEntitlement();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [storiesArchiveMounted, setStoriesArchiveMounted] = useState(false);
  const [storiesArchiveVisible, setStoriesArchiveVisible] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createStep, setCreateStep] = useState<"menu" | "post" | "story">("menu");
  const [postInput, setPostInput] = useState("");
  const [postInputError, setPostInputError] = useState(false);
  const [selectedPostPlaceId, setSelectedPostPlaceId] = useState<string | null>(null);
  const [postPlaceError, setPostPlaceError] = useState(false);
  const [postPlacePickerOpen, setPostPlacePickerOpen] = useState(false);
  const [postPhotos, setPostPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [uploadingPostPhotos, setUploadingPostPhotos] = useState(false);
  const [storyPhotos, setStoryPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [storyPhotosError, setStoryPhotosError] = useState(false);
  const [selectedStoryPlaceId, setSelectedStoryPlaceId] = useState<string | null>(null);
  const [storyPlaceError, setStoryPlaceError] = useState(false);
  const [storyPlacePickerOpen, setStoryPlacePickerOpen] = useState(false);
  const [uploadingStory, setUploadingStory] = useState(false);
  const createPost = useCreatePost();
  const createStory = useCreateStory();
  const toggleThemeMode = () => {
    const nextMode: ThemeMode = mode === "dark" ? "light" : "dark";
    setMode(nextMode);
  };

  useEffect(() => {
    if (!loading && !user) {
      navigation.navigate("Auth");
    }
  }, [loading, user, navigation]);

  useEffect(() => {
    const requestedCreateStep = route.params?.openCreateStep;
    const shouldOpenCreateModal = Boolean(route.params?.openCreateModal) || Boolean(requestedCreateStep);
    if (!shouldOpenCreateModal) return;
    setCreateStep(requestedCreateStep ?? "menu");
    setCreateModalOpen(true);
    navigation.setParams({ openCreateStep: undefined, openCreateModal: undefined });
  }, [navigation, route.params?.openCreateModal, route.params?.openCreateStep]);

  const stylesThemed = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16 },
        createMenuBody: {
          paddingHorizontal: 12,
          paddingVertical: 12,
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
          borderColor: colors.border,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 10,
          paddingVertical: 14,
          gap: 12,
        },
        createOptionRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        createOptionLabel: {
          color: colors.text,
          fontSize: 17,
          fontWeight: "700",
          textAlign: "center",
        },
        createOptionHint: {
          color: colors.textMuted,
          fontSize: 12,
          textAlign: "center",
        },
        createOptionLoading: {
          marginTop: 6,
        },
        createPostSheetBody: {
          paddingHorizontal: 12,
          paddingVertical: 8,
          minHeight: 420,
        },
        postUploaderBox: {
          marginTop: 8,
          borderWidth: 1,
          borderStyle: "dashed",
          borderColor: colors.border,
          borderRadius: 14,
          minHeight: 86,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 12,
          paddingVertical: 10,
          gap: 6,
        },
        postUploaderBoxError: {
          borderColor: colors.danger,
        },
        postUploaderText: {
          color: colors.textMuted,
          fontSize: 14,
          fontWeight: "600",
          textAlign: "center",
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
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
        },
        postPhotoCount: {
          color: colors.textMuted,
          fontSize: 12,
        },
        postRequiredHint: {
          marginTop: 6,
          color: colors.textMuted,
          fontSize: 12,
          fontWeight: "600",
        },
        composerWrap: {
          marginTop: 12,
        },
        postPlaceSelectTrigger: {
          marginTop: 10,
          minHeight: 46,
          borderWidth: 1,
          borderRadius: 12,
          borderColor: colors.border,
          backgroundColor: colors.background,
          paddingHorizontal: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        },
        postPlaceSelectTriggerError: {
          borderColor: colors.danger,
        },
        postPlaceSelectText: {
          flex: 1,
          color: colors.text,
          fontSize: 14,
          fontWeight: "600",
        },
        postPlaceSelectPlaceholder: {
          color: colors.textMuted,
          fontSize: 14,
          fontWeight: "500",
        },
        postPlaceOptionsWrap: {
          marginTop: 8,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          overflow: "hidden",
        },
        postPlaceOption: {
          minHeight: 42,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        postPlaceOptionText: {
          color: colors.text,
          fontSize: 14,
          fontWeight: "600",
          flex: 1,
        },
        createStoryLoadingOnlyWrap: {
          minHeight: 320,
          alignItems: "center",
          justifyContent: "center",
        },
        createFlowBackBtn: {
          minHeight: 48,
          height: 48,
          borderRadius: 12,
          paddingHorizontal: 12,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          flex: 1,
        },
        createFlowBackBtnText: {
          color: colors.textMuted,
          fontSize: 13,
          fontWeight: "700",
        },
        createPostBackRow: {
          marginTop: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        },
        createStoryActionsRow: {
          marginTop: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        },
        createStoryPublishBtn: {
          ...primaryPressableStyle,
          flex: 1,
          minHeight: 48,
          height: 48,
          borderRadius: 12,
          marginTop: 0,
        },
        createStoryPublishBtnText: {
          ...primaryPressableTextStyle,
          fontSize: 16,
        },
        createPostLoadingOnlyWrap: {
          minHeight: 420,
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
          color: colors.textMuted,
          fontSize: 13,
          fontWeight: "600",
        },
        card: {
          backgroundColor: colors.card,
          borderRadius: 16,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          marginBottom: 16,
          padding: 16,
        },
        profileRow: { flexDirection: "row", alignItems: "center" },
        avatarWrap: {
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.surface,
          alignItems: "center",
          justifyContent: "center",
        },
        avatarText: { color: colors.primary, fontSize: 24, fontWeight: "700" },
        name: { fontSize: 18, fontWeight: "700", color: colors.text },
        email: { color: colors.textMuted, marginTop: 2, fontSize: 13 },
        emailVerificationRow: {
          marginTop: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        },
        emailBadge: {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          borderWidth: 1,
          borderRadius: 999,
          paddingHorizontal: 10,
          paddingVertical: 6,
        },
        emailBadgeText: {
          fontSize: 12,
          fontWeight: "700",
        },
        verifyBtn: {
          minHeight: 32,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.primary,
          paddingHorizontal: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
        },
        verifyBtnText: {
          color: colors.primary,
          fontSize: 12,
          fontWeight: "700",
        },
        settingsBtn: {
          marginLeft: "auto",
          width: 34,
          height: 34,
          borderRadius: 17,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
        },
        statRow: { flexDirection: "row", gap: 6, marginBottom: 6 },
        statCard: {
          flex: 1,
          backgroundColor: colors.card,
          borderRadius: 12,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          paddingVertical: 12,
          alignItems: "center",
        },
        statValue: { color: colors.text, fontSize: 22, fontWeight: "700" },
        statLabel: { color: colors.textMuted, fontSize: 11 },
        bioCard: {
          backgroundColor: colors.card,
          borderRadius: 12,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          paddingHorizontal: 14,
          paddingVertical: 12,
          marginBottom: 16,
        },
        bioLabel: {
          color: colors.textMuted,
          fontSize: 12,
          fontWeight: "700",
          textTransform: "uppercase",
          letterSpacing: 0.25,
          marginBottom: 6,
        },
        bioText: {
          color: colors.text,
          fontSize: 14,
          lineHeight: 20,
        },
        suggestionsSection: {
          marginBottom: 16,
        },
        suggestionsHeader: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        },
        suggestionsTitle: {
          color: colors.text,
          fontSize: 18,
          fontWeight: "700",
        },
        suggestionsSubtitle: {
          color: colors.textMuted,
          fontSize: 12,
        },
        suggestionScrollContent: {
          paddingRight: 2,
          gap: 10,
        },
        suggestionCard: {
          width: 168,
          borderRadius: 14,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.card,
          padding: 12,
        },
        suggestionAvatarWrap: {
          width: 66,
          height: 66,
          borderRadius: 33,
          overflow: "hidden",
          alignSelf: "center",
          backgroundColor: colors.surface,
        },
        suggestionAvatarFallback: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
        },
        suggestionAvatarFallbackText: {
          color: colors.text,
          fontSize: 20,
          fontWeight: "700",
        },
        suggestionName: {
          marginTop: 10,
          color: colors.text,
          fontSize: 15,
          fontWeight: "700",
          textAlign: "center",
        },
        suggestionReason: {
          marginTop: 4,
          color: colors.textMuted,
          fontSize: 12,
          textAlign: "center",
          minHeight: 16,
        },
        suggestionFollowBtn: {
          marginTop: 10,
          ...primaryPressableStyle,
          minHeight: 38,
          borderRadius: 10,
        },
        suggestionFollowBtnText: {
          ...primaryPressableTextStyle,
          fontSize: 14,
        },
        actionsCard: {
          backgroundColor: colors.card,
          borderRadius: 16,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          overflow: "hidden",
        },
        link: {
          paddingVertical: 14,
          paddingHorizontal: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        },
        linkText: { color: colors.text, fontSize: 14, flex: 1, minWidth: 0 },
        linkMenuBadge: {
          minWidth: 22,
          height: 22,
          borderRadius: 11,
          paddingHorizontal: 6,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
        },
        linkMenuBadgeText: { color: colors.onPrimary, fontSize: 11, fontWeight: "800" },
        signOut: { ...primaryPressableStyle, marginTop: 16, marginBottom: 16, borderRadius: 10, minHeight: 44 },
        signOutText: {
          ...primaryPressableTextStyle,
          fontSize: 16,
        },
        modalBackdrop: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.6)",
          justifyContent: "flex-end",
          alignItems: "stretch",
        },
        modalContent: {
          backgroundColor: colors.card,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          borderBottomWidth: 0,
          paddingBottom: Math.max(insets.bottom, 10),
          flexGrow: 0,
          flexShrink: 1,
        },
        modalContentLarge: { maxHeight: "75%" },
        modalHeader: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        modalTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
        closeBtn: {
          backgroundColor: colors.surface,
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderWidth: 1,
          borderColor: colors.border,
        },
        closeText: { color: colors.text, fontSize: 12, fontWeight: "600" },
      }),
    [colors, insets.bottom],
  );

  const userName = `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || "User";
  const isEmailVerified = Boolean(profile?.is_verified);
  const warningColor = "#f59e0b";
  const openPrivacy = () => {
    void Linking.openURL(PRIVACY_URL);
  };
  const openManageSubscription = () => {
    void Linking.openURL(Platform.OS === "ios" ? APPLE_SUBSCRIPTION_URL : GOOGLE_SUBSCRIPTION_URL);
  };

  const subscriptionLabel = !subscriptionStatus
    ? "Not subscribed"
    : subscriptionStatus === "trialing"
      ? "Trial active"
      : subscriptionStatus === "active"
        ? "Active"
        : subscriptionStatus === "grace_period"
          ? "Grace period"
          : subscriptionStatus === "billing_retry"
            ? "Billing issue"
            : "Expired";
  const postPlaceOptions = useMemo(
    () =>
      businessCards
        .map((card) => ({
          id: card.id,
          name: card.name?.trim() || "Unknown place",
        }))
        .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index),
    [businessCards],
  );
  const createPlaceId = selectedPostPlaceId;
  const currentUserAvatar = profile?.avatar_url?.trim() || null;

  const closeCreateModal = () => {
    setCreateModalOpen(false);
    setCreateStep("menu");
    resetPostComposer();
  };

  const resetPostComposer = () => {
    setPostInput("");
    setPostInputError(false);
    setSelectedPostPlaceId(null);
    setPostPlaceError(false);
    setPostPlacePickerOpen(false);
    setPostPhotos([]);
    setSelectedStoryPlaceId(null);
    setStoryPlaceError(false);
    setStoryPlacePickerOpen(false);
    setStoryPhotos([]);
    setStoryPhotosError(false);
  };

  const goToFeedWithFocus = (focus: { postId?: string; storyId?: string }) => {
    closeCreateModal();
    navigation.navigate("Feed", { screen: "FeedMain" });
    navigation.navigate("Feed", {
      screen: "FeedMain",
      params: {
        focusPostId: focus.postId,
        focusStoryId: focus.storyId,
      },
    });
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
      base64: false,
    });
    if (result.canceled) return;
    setPostPhotos((prev) => {
      const merged = [...prev, ...result.assets];
      const dedup = merged.filter((asset, index, all) => all.findIndex((candidate) => candidate.uri === asset.uri) === index);
      return dedup.slice(0, MAX_POST_PHOTOS);
    });
  };

  const pickStoryPhotos = async () => {
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
      base64: false,
    });
    if (result.canceled) return;
    setStoryPhotos((prev) => {
      const merged = [...prev, ...result.assets];
      const dedup = merged.filter((asset, index, all) => all.findIndex((candidate) => candidate.uri === asset.uri) === index);
      return dedup.slice(0, MAX_POST_PHOTOS);
    });
    setStoryPhotosError(false);
  };

  const uploadPostPhotos = async () => {
    if (!postPhotos.length) return null;
    setUploadingPostPhotos(true);
    try {
      const uploadedUrls: string[] = [];
      for (let idx = 0; idx < postPhotos.length; idx += 1) {
        const asset = postPhotos[idx];
        const { bytes, contentType, fileExtension } = await prepareImageForStorageUpload(asset, {
          maxLongEdgePx: POST_STORAGE_MAX_LONG_EDGE,
        });
        if (!bytes.byteLength) {
          throw new Error("Selected image is empty. Please try another image.");
        }
        const path = `${user?.id ?? "anonymous"}/post-${Date.now()}-${idx}.${fileExtension}`;
        const { error: uploadError } = await supabase.storage.from(STORIES_BUCKET).upload(path, bytes, {
          upsert: true,
          contentType,
        });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from(STORIES_BUCKET).getPublicUrl(path);
        uploadedUrls.push(data.publicUrl);
      }
      return JSON.stringify(uploadedUrls);
    } finally {
      setUploadingPostPhotos(false);
    }
  };

  const uploadStoryPhotos = async () => {
    if (!storyPhotos.length) return null;
    setUploadingStory(true);
    try {
      const uploadedUrls: string[] = [];
      for (let idx = 0; idx < storyPhotos.length; idx += 1) {
        const asset = storyPhotos[idx];
        const { bytes, contentType, fileExtension } = await prepareImageForStorageUpload(asset, {
          maxLongEdgePx: STORY_STORAGE_MAX_LONG_EDGE,
        });
        if (!bytes.byteLength) {
          throw new Error("Selected image is empty. Please try another image.");
        }
        const path = `${user?.id ?? "anonymous"}/story-${Date.now()}-${idx}.${fileExtension}`;
        const { error: uploadError } = await supabase.storage.from(STORIES_BUCKET).upload(path, bytes, {
          upsert: true,
          contentType,
        });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from(STORIES_BUCKET).getPublicUrl(path);
        uploadedUrls.push(data.publicUrl);
      }
      return JSON.stringify(uploadedUrls);
    } finally {
      setUploadingStory(false);
    }
  };

  const submitPost = async () => {
    if (!createPlaceId) {
      setPostPlaceError(true);
      return;
    }
    const trimmedPostInput = postInput.trim();
    if (!trimmedPostInput) {
      setPostInputError(true);
      return;
    }
    if (createPost.isPending || uploadingPostPhotos) return;
    try {
      const mediaUrl = await uploadPostPhotos();
      const created = (await createPost.mutateAsync({
        placeId: createPlaceId,
        content: trimmedPostInput,
        mediaUrl,
      })) as unknown as { id: string | number };
      resetPostComposer();
      goToFeedWithFocus({ postId: String(created.id) });
    } catch (error) {
      Alert.alert("Post failed", formatErrorForAlert(error, "Could not publish post."));
    }
  };

  const submitStory = async () => {
    if (!selectedStoryPlaceId) {
      setStoryPlaceError(true);
      return;
    }
    if (!storyPhotos.length) {
      setStoryPhotosError(true);
      return;
    }
    if (createStory.isPending || uploadingStory) return;
    try {
      const mediaUrl = await uploadStoryPhotos();
      const created = (await createStory.mutateAsync({
        placeId: selectedStoryPlaceId,
        content: "New story",
        mediaUrl,
        expiryTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })) as unknown as { id: string | number };
      resetPostComposer();
      goToFeedWithFocus({ storyId: String(created.id) });
    } catch (error) {
      Alert.alert("Story failed", formatErrorForAlert(error, "Could not publish story."));
    }
  };

  const actions: ActionItem[] = [
    // { key: "purchases", label: "My Purchases", icon: "bag-handle-outline", onPress: () => navigation.navigate("MyPurchases") },
    {
      key: "subscription",
      label: isActive ? "Manage subscription" : "Get PixAI Premium",
      icon: "sparkles-outline",
      onPress: () => (isActive ? openManageSubscription() : navigation.navigate("SubscriptionPaywall")),
    },
    {
      key: "notifications",
      label: t("notifications.sheetTitle"),
      icon: "notifications-outline",
      onPress: () => setNotificationsOpen(true),
      badgeCount: unreadNotifications,
    },
    {
      key: "stories-archive",
      label: "Archive",
      icon: "archive-outline",
      onPress: () => {
        setStoriesArchiveMounted(true);
        setStoriesArchiveVisible(true);
      },
    },
    { key: "privacy", label: "Privacy & Security", icon: "shield-outline", onPress: openPrivacy },
    { key: "settings", label: "Settings", icon: "settings-outline", onPress: () => navigation.navigate("EditProfile") },
  ];

  if (!loading && !user) {
    return null;
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={stylesThemed.root}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: Math.max(insets.bottom, 24) }}
      >
      <AppHeader
        title={t("header.profile")}
        leftIcon="add"
        onLeftPress={() => {
          setCreateStep("menu");
          setCreateModalOpen(true);
        }}
        rightIcon={mode === "dark" ? "sunny-outline" : "moon-outline"}
        onRightPress={toggleThemeMode}
        onNotificationsPress={() => setNotificationsOpen(true)}
      />
      <View style={stylesThemed.card}>
        <View style={stylesThemed.profileRow}>
          <View style={stylesThemed.avatarWrap}>
            {profile?.avatar_url ? (
              <SmartImage
                uri={profile.avatar_url}
                recyclingKey={profile.avatar_url}
                style={{ width: 56, height: 56, borderRadius: 28 }}
                contentFit="cover"
              />
            ) : (
              <Text style={stylesThemed.avatarText}>{userName.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={stylesThemed.name}>{userName}</Text>
            <Text style={stylesThemed.email}>{profile?.email ?? user?.email}</Text>
            <View style={stylesThemed.emailVerificationRow}>
              <View
                style={[
                  stylesThemed.emailBadge,
                  {
                    borderColor: isEmailVerified ? "#22c55e" : warningColor,
                    backgroundColor: isEmailVerified ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.12)",
                  },
                ]}
              >
                <Ionicons name={isEmailVerified ? "checkmark-circle-outline" : "alert-circle-outline"} size={14} color={isEmailVerified ? "#22c55e" : warningColor} />
                <Text style={[stylesThemed.emailBadgeText, { color: isEmailVerified ? "#22c55e" : warningColor }]}>
                  {isEmailVerified ? "Email verified" : "Email not verified"}
                </Text>
              </View>
              {!isEmailVerified ? (
                <Pressable style={stylesThemed.verifyBtn} onPress={() => navigation.navigate("VerifyEmailOtp", { flow: "verify" })}>
                  <Text style={stylesThemed.verifyBtnText}>Verify</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          <Pressable style={stylesThemed.settingsBtn} onPress={() => navigation.navigate("EditProfile")}>
            <Ionicons name="settings-outline" size={16} color={colors.text} />
          </Pressable>
        </View>
        <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
          <Text style={{ color: colors.text, fontWeight: "700" }}>PixAI subscription: {subscriptionLabel}</Text>
          {isTrial ? <Text style={{ color: colors.textMuted, marginTop: 2 }}>Trial in progress</Text> : null}
          {expiresAt ? (
            <Text style={{ color: colors.textMuted, marginTop: 2 }}>
              Expires: {new Date(expiresAt).toLocaleDateString()}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={stylesThemed.statRow}>
        <Pressable
          style={stylesThemed.statCard}
          onPress={() => navigation.navigate("Bookings", { screen: "BookingsMain" })}
          accessibilityRole="button"
          accessibilityLabel="Open bookings"
        >
          <Text style={stylesThemed.statValue}>{bookings.length}</Text>
          <Text style={stylesThemed.statLabel}>Bookings</Text>
        </Pressable>
        
        <Pressable
          style={stylesThemed.statCard}
          onPress={() => navigation.navigate("Favorites")}
          accessibilityRole="button"
          accessibilityLabel="Open favorites"
        >
          <Text style={stylesThemed.statValue}>{favorites.length}</Text>
          <Text style={stylesThemed.statLabel}>Favorites</Text>
        </Pressable>
        <View style={stylesThemed.statCard}>
          <Text style={stylesThemed.statValue}>0</Text>
          <Text style={stylesThemed.statLabel}>Reviews</Text>
        </View>
      </View>
      <View style={stylesThemed.statRow}>
        <Pressable
          style={stylesThemed.statCard}
          onPress={() =>
            navigation.navigate("Feed", {
              screen: "FeedMain",
              params: { filterUserId: user?.id ?? profile?.id, postsScope: "mine" },
            })
          }
          accessibilityRole="button"
          accessibilityLabel="Open my posts in feed"
        >
          <Text style={stylesThemed.statValue}>{postsCount}</Text>
          <Text style={stylesThemed.statLabel}>Posts</Text>
        </Pressable>
        <Pressable
          style={stylesThemed.statCard}
          onPress={() => navigation.navigate("Cart", { screen: "CartMain" })}
          accessibilityRole="button"
          accessibilityLabel="Open messages"
        >
          <Text style={stylesThemed.statValue}>{followersCount}</Text>
          <Text style={stylesThemed.statLabel}>Followed</Text>
        </Pressable>
        <Pressable
          style={stylesThemed.statCard}
          onPress={() => navigation.navigate("Cart", { screen: "CartMain" })}
          accessibilityRole="button"
          accessibilityLabel="Open messages"
        >
          <Text style={stylesThemed.statValue}>{followingCount}</Text>
          <Text style={stylesThemed.statLabel}>Following</Text>
        </Pressable>
        
      </View>
      <View style={stylesThemed.suggestionsSection}>
        <View style={stylesThemed.suggestionsHeader}>
          <Text style={stylesThemed.suggestionsTitle}>Suggestions</Text>
          <Text style={stylesThemed.suggestionsSubtitle}>Follow some accounts</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={stylesThemed.suggestionScrollContent}>
          {suggestions.length ? (
            suggestions.map((item) => (
              <View key={item.id} style={stylesThemed.suggestionCard}>
                <View style={stylesThemed.suggestionAvatarWrap}>
                  {item.avatar_url ? (
                    <SmartImage
                      uri={getOptimizedImageUrl(item.avatar_url, 132, 132, 72)}
                      fallbackUri={item.avatar_url}
                      style={{ width: 66, height: 66 }}
                      contentFit="cover"
                      skipBundledPlaceholder
                    />
                  ) : (
                    <View style={stylesThemed.suggestionAvatarFallback}>
                      <Text style={stylesThemed.suggestionAvatarFallbackText}>
                        {profileFullName(item.first_name, item.last_name).charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={stylesThemed.suggestionName} numberOfLines={1}>
                  {profileFullName(item.first_name, item.last_name)}
                </Text>
                <Text style={stylesThemed.suggestionReason} numberOfLines={1}>
                  {item.reason}
                </Text>
                <Pressable
                  style={stylesThemed.suggestionFollowBtn}
                  onPress={() => void toggleFollow.mutateAsync({ followingId: item.id, isFollowing: false })}
                  disabled={toggleFollow.isPending}
                >
                  <Text style={stylesThemed.suggestionFollowBtnText}>Follow</Text>
                </Pressable>
              </View>
            ))
          ) : (
            <View style={[stylesThemed.suggestionCard, { width: 220 }]}>
              <Text style={stylesThemed.suggestionReason}>No suggestions yet</Text>
            </View>
          )}
        </ScrollView>
      </View>
      <View style={stylesThemed.bioCard}>
        <Text style={stylesThemed.bioLabel}>Bio</Text>
        <Text style={stylesThemed.bioText}>{profile?.bio?.trim() || "Tell people about yourself in Edit Profile."}</Text>
      </View>

      <View style={stylesThemed.actionsCard}>
        {actions.map((item, index) => (
          <Pressable
            key={item.key}
            style={[stylesThemed.link, index === actions.length - 1 ? { borderBottomWidth: 0 } : null]}
            onPress={item.onPress}
          >
            <Ionicons name={item.icon} size={20} color={colors.textMuted} />
            <Text style={stylesThemed.linkText} numberOfLines={1}>
              {item.label}
            </Text>
            {item.badgeCount != null && item.badgeCount > 0 ? (
              <View style={stylesThemed.linkMenuBadge}>
                <Text style={stylesThemed.linkMenuBadgeText}>{item.badgeCount > 9 ? "9+" : String(item.badgeCount)}</Text>
              </View>
            ) : null}
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>
      {(role === "admin" || role === "partner") && (
        <Pressable style={[stylesThemed.link, { marginTop: 10 }]} onPress={() => navigation.navigate("AdminImageUpload")}>
          <Text style={stylesThemed.linkText}>Partner: upload listing image</Text>
        </Pressable>
      )}
      <Pressable style={stylesThemed.signOut} onPress={() => void signOut()}>
        <Text style={stylesThemed.signOutText}>Log Out</Text>
      </Pressable>

      <BottomSheetPickerModal
        visible={createModalOpen}
        onClose={closeCreateModal}
        title={createStep === "menu" ? "Create" : createStep === "post" ? "Create post" : "Create story"}
        maxHeightFraction={0.68}
      >
        {createStep === "menu" ? (
          <View style={stylesThemed.createMenuBody}>
            <View style={stylesThemed.createOptionGrid}>
              <Pressable style={stylesThemed.createOptionCard} onPress={() => setCreateStep("post")}>
                <Ionicons name="grid-outline" size={34} color={colors.text} />
                <Text style={stylesThemed.createOptionLabel}>Post</Text>
                <Text style={stylesThemed.createOptionHint}>Create a new post</Text>
              </Pressable>
              <Pressable
                style={stylesThemed.createOptionCard}
                onPress={() => {
                  setCreateStep("story");
                }}
                disabled={uploadingStory || createStory.isPending}
              >
                <Ionicons name="add-circle-outline" size={34} color={colors.text} />
                <Text style={stylesThemed.createOptionLabel}>Story</Text>
                {uploadingStory || createStory.isPending ? (
                  <ActivityIndicator style={stylesThemed.createOptionLoading} size="small" color={colors.primary} />
                ) : (
                  <Text style={stylesThemed.createOptionHint}>Share a quick story</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : createStep === "post" ? (
          <View style={stylesThemed.createPostSheetBody}>
            {createPost.isPending || uploadingPostPhotos ? (
              <View style={stylesThemed.createPostLoadingOnlyWrap}>
                <View style={stylesThemed.createPostLoadingWrap}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={stylesThemed.createPostLoadingText}>
                    {uploadingPostPhotos ? "Uploading photos..." : "Publishing post..."}
                  </Text>
                </View>
              </View>
            ) : null}
            {!(createPost.isPending || uploadingPostPhotos) ? (
              <>
                <Pressable style={stylesThemed.postUploaderBox} onPress={() => void pickPostPhotos()}>
                  <Ionicons name="images-outline" size={22} color={colors.textMuted} />
                  <Text style={stylesThemed.postUploaderText}>Tap to add photos</Text>
                  <Text style={stylesThemed.postPhotoCount}>
                    {postPhotos.length ? `${postPhotos.length}/${MAX_POST_PHOTOS} selected` : `Up to ${MAX_POST_PHOTOS} photos`}
                  </Text>
                </Pressable>
                <Text style={stylesThemed.postRequiredHint}>Required: place and post text.</Text>
                {postPhotos.length ? (
                  <View style={stylesThemed.postPhotosList}>
                    {postPhotos.map((photo) => (
                      <View key={photo.uri} style={stylesThemed.postPhotoItem}>
                        <SmartImage uri={photo.uri} style={stylesThemed.postPhotoThumb} contentFit="cover" />
                        <Pressable
                          style={stylesThemed.postPhotoRemoveBtn}
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
                <Pressable
                  style={[
                    stylesThemed.postPlaceSelectTrigger,
                    postPlaceError ? stylesThemed.postPlaceSelectTriggerError : null,
                  ]}
                  onPress={() => setPostPlacePickerOpen((prev) => !prev)}
                >
                  <Text style={selectedPostPlaceId ? stylesThemed.postPlaceSelectText : stylesThemed.postPlaceSelectPlaceholder}>
                    {selectedPostPlaceId
                      ? (postPlaceOptions.find((option) => option.id === selectedPostPlaceId)?.name ?? "Selected place")
                      : "Select place"}
                  </Text>
                  <Ionicons name={postPlacePickerOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
                </Pressable>
                {postPlacePickerOpen ? (
                  <View style={stylesThemed.postPlaceOptionsWrap}>
                    {postPlaceOptions.map((option, index) => (
                      <Pressable
                        key={option.id}
                        style={[stylesThemed.postPlaceOption, index === postPlaceOptions.length - 1 ? { borderBottomWidth: 0 } : null]}
                        onPress={() => {
                          setSelectedPostPlaceId(option.id);
                          setPostPlaceError(false);
                          setPostPlacePickerOpen(false);
                        }}
                      >
                        <Text style={stylesThemed.postPlaceOptionText}>{option.name}</Text>
                        {selectedPostPlaceId === option.id ? <Ionicons name="checkmark" size={16} color={colors.primary} /> : null}
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <View style={stylesThemed.composerWrap}>
                  <CommentComposer
                    avatarUrl={currentUserAvatar}
                    value={postInput}
                    onChangeText={(value) => {
                      setPostInput(value);
                      if (postInputError && value.trim()) {
                        setPostInputError(false);
                      }
                    }}
                    placeholder="Share an update..."
                    canSend={!createPost.isPending && !uploadingPostPhotos}
                    sending={createPost.isPending || uploadingPostPhotos}
                    onSend={() => void submitPost()}
                    minHeight={120}
                    maxHeight={220}
                    hasError={postInputError}
                  />
                </View>
              </>
            ) : null}
            {!(createPost.isPending || uploadingPostPhotos) ? (
              <View style={stylesThemed.createPostBackRow}>
                <Pressable style={stylesThemed.createFlowBackBtn} onPress={() => setCreateStep("menu")}>
                  <Text style={stylesThemed.createFlowBackBtnText}>Back to create options</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={stylesThemed.createPostSheetBody}>
            {createStory.isPending || uploadingStory ? (
              <View style={stylesThemed.createStoryLoadingOnlyWrap}>
                <View style={stylesThemed.createPostLoadingWrap}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={stylesThemed.createPostLoadingText}>
                    {uploadingStory ? "Uploading photos..." : "Publishing story..."}
                  </Text>
                </View>
              </View>
            ) : null}
            {!(createStory.isPending || uploadingStory) ? (
              <>
                <Pressable
                  style={[stylesThemed.postUploaderBox, storyPhotosError ? stylesThemed.postUploaderBoxError : null]}
                  onPress={() => void pickStoryPhotos()}
                >
                  <Ionicons name="images-outline" size={22} color={colors.textMuted} />
                  <Text style={stylesThemed.postUploaderText}>Tap to add photos</Text>
                  <Text style={stylesThemed.postPhotoCount}>
                    {storyPhotos.length ? `${storyPhotos.length}/${MAX_POST_PHOTOS} selected` : `Up to ${MAX_POST_PHOTOS} photos`}
                  </Text>
                </Pressable>
                <Text style={stylesThemed.postRequiredHint}>Required: at least 1 photo and place.</Text>
                {storyPhotos.length ? (
                  <View style={stylesThemed.postPhotosList}>
                    {storyPhotos.map((photo) => (
                      <View key={photo.uri} style={stylesThemed.postPhotoItem}>
                        <SmartImage uri={photo.uri} style={stylesThemed.postPhotoThumb} contentFit="cover" />
                        <Pressable
                          style={stylesThemed.postPhotoRemoveBtn}
                          onPress={() => {
                            setStoryPhotos((prev) => prev.filter((item) => item.uri !== photo.uri));
                          }}
                        >
                          <Ionicons name="close" size={11} color={colors.text} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}
                <Pressable
                  style={[
                    stylesThemed.postPlaceSelectTrigger,
                    storyPlaceError ? stylesThemed.postPlaceSelectTriggerError : null,
                  ]}
                  onPress={() => setStoryPlacePickerOpen((prev) => !prev)}
                >
                  <Text style={selectedStoryPlaceId ? stylesThemed.postPlaceSelectText : stylesThemed.postPlaceSelectPlaceholder}>
                    {selectedStoryPlaceId
                      ? (postPlaceOptions.find((option) => option.id === selectedStoryPlaceId)?.name ?? "Selected place")
                      : "Select place"}
                  </Text>
                  <Ionicons name={storyPlacePickerOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
                </Pressable>
                {storyPlacePickerOpen ? (
                  <View style={stylesThemed.postPlaceOptionsWrap}>
                    {postPlaceOptions.map((option, index) => (
                      <Pressable
                        key={option.id}
                        style={[stylesThemed.postPlaceOption, index === postPlaceOptions.length - 1 ? { borderBottomWidth: 0 } : null]}
                        onPress={() => {
                          setSelectedStoryPlaceId(option.id);
                          setStoryPlaceError(false);
                          setStoryPlacePickerOpen(false);
                        }}
                      >
                        <Text style={stylesThemed.postPlaceOptionText}>{option.name}</Text>
                        {selectedStoryPlaceId === option.id ? <Ionicons name="checkmark" size={16} color={colors.primary} /> : null}
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}
            {!(createStory.isPending || uploadingStory) ? (
              <View style={stylesThemed.createStoryActionsRow}>
                <Pressable style={stylesThemed.createFlowBackBtn} onPress={() => setCreateStep("menu")}>
                  <Text style={stylesThemed.createFlowBackBtnText}>Back to create options</Text>
                </Pressable>
                <Pressable
                  style={stylesThemed.createStoryPublishBtn}
                  onPress={() => void submitStory()}
                  disabled={createStory.isPending || uploadingStory}
                >
                  <Text style={stylesThemed.createStoryPublishBtnText}>Publish story</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        )}
      </BottomSheetPickerModal>

      <NotificationsSheetModal visible={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
    </ScrollView>

    {storiesArchiveMounted ? (
      <View
        style={[
          StyleSheet.absoluteFillObject,
          {
            zIndex: 100,
            opacity: storiesArchiveVisible ? 1 : 0,
            pointerEvents: storiesArchiveVisible ? "auto" : "none",
          },
        ]}
      >
        <StoriesArchiveView
          overlayActive={storiesArchiveVisible}
          onRequestClose={() => setStoriesArchiveVisible(false)}
        />
      </View>
    ) : null}
    </View>
  );
}

export default function ProfileScreen() {
  return <ProfileScreenContent />;
}