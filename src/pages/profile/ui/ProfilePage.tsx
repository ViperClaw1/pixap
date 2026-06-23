import { AppPressable } from "@/shared/ui/app-pressable";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Keyboard,
  Linking,
  Platform,
  Alert,
  useWindowDimensions,
} from "react-native";
import { useNavigation, useRoute, useIsFocused, type RouteProp } from "@react-navigation/native";
import type { CompositeNavigationProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as WebBrowser from "expo-web-browser";
import Toast from "react-native-toast-message";
import { useAuth } from "@/app/providers/AuthProvider";
import { useProfile, useUserRole, isProfileAdmin } from "@/entities/user";
import { useAdminModerationPendingCount } from "@/entities/admin-moderation";
import { useProfileSocialMetrics, useSuggestedProfiles, useToggleFollow } from "@/entities/user";
import { useBusinessCards } from "@/entities/business-card";
import { useUnreadCount } from "@/entities/notification";
import { useFavorites } from "@/entities/favorite";
import { useBookings } from "@/entities/booking";
import { useCreatePost } from "@/entities/post";
import { useCreateStory } from "@/entities/story";
import type { ProfileStackParamList, RootTabParamList } from "@/app/navigation/types";
import { navigateToPublicProfile } from "@/app/navigation/navigationHelpers";
import { StoriesArchiveView } from "@/widgets/stories-archive";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { PROFILE_CARD_PADDING, PROFILE_COMPACT_WIDTH, resolveProfileAvatarSize, useProfileStyles } from "./profileStyles";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { UserAvatarImage } from "@/shared/ui/user-avatar-image";
import { useEntitlement } from "@/entities/subscription";
import { useBookingCredits } from "@/entities/booking-credits";
import { usePreferenceOnboardingGate } from "@/features/preference-onboarding";
import { BookingCreditsBadge } from "@/shared/ui/booking-credits-badge/BookingCreditsBadge";
import { ProfileOnboardingActions } from "./ProfileOnboardingActions";
import { ProfilePageSkeleton } from "./ProfilePageSkeleton";
import { ProfileSuggestionsSkeleton } from "./ProfileSuggestionsSkeleton";
import { BottomSheetPickerModal } from "@/shared/ui/bottom-sheet-picker/BottomSheetPickerModal";
import { CommentComposer } from "@/shared/ui/comment-composer/CommentComposer";
import { AppHeader } from "@/shared/ui/app-header/AppHeader";
import { NotificationsSheetModal } from "@/shared/ui/notifications-sheet";
import { profileStoryPathBuilder, uploadPostPickerAssets, uploadStoryPickerAssets } from "@/entities/story/lib/uploadStoriesBucketMedia";
import type { ThemeMode } from "@/app/providers/ThemeProvider";
import {
  APPLE_SUBSCRIPTION_URL,
  GOOGLE_SUBSCRIPTION_URL,
  MAX_POST_PHOTOS,
  PRIVACY_URL,
  TERMS_URL,
} from "../model/constants";
import { formatErrorForAlert } from "@/shared/lib/formatErrorForAlert";
import { profileFullName } from "../model/format";
import {
  ensureEditProfileScreenReady,
  scheduleEditProfilePrefetch,
} from "../lib/prefetchEditProfileScreen";

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<ProfileStackParamList, "ProfileMain">,
  BottomTabNavigationProp<RootTabParamList>
>;
const SCROLL_BOTTOM_PADDING = 32;
const PROFILE_INFO_MARGIN_LEFT = 12;
const VERIFICATION_BASE_FONT_SIZE = 12;
const VERIFICATION_RU_FONT_SIZE = 10;
const VERIFICATION_MIN_FONT_SIZE = 8;
const VERIFICATION_CHAR_WIDTH_RATIO = 0.58;
const VERIFICATION_FIXED_WIDTH = 14 + 4 + 8 * 2 + 10 * 2 + 6;
type ActionItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  badgeCount?: number;
};

function ProfileScreenContent() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<ProfileStackParamList, "ProfileMain">>();
  const { colors, mode, setMode } = useAppTheme();
  const { user, loading, signOut } = useAuth();
  const isScreenFocused = useIsFocused();
  const profileQueriesEnabled = !!user && isScreenFocused;
  const { data: profile, isPending: profilePending } = useProfile({ enabled: profileQueriesEnabled });
  const unreadNotifications = useUnreadCount({ enabled: profileQueriesEnabled });
  const { data: favorites = [] } = useFavorites({ enabled: profileQueriesEnabled });
  const { data: bookings = [] } = useBookings({ enabled: profileQueriesEnabled });
  const { data: businessCards = [] } = useBusinessCards(undefined, undefined, { enabled: profileQueriesEnabled });
  const { role } = useUserRole({ enabled: profileQueriesEnabled });
  const { postsCount, followersCount, followingCount } = useProfileSocialMetrics({ enabled: profileQueriesEnabled });
  const { suggestions, isLoading: suggestionsLoading, isFetching: suggestionsFetching } = useSuggestedProfiles(
    12,
    { enabled: profileQueriesEnabled },
  );
  const toggleFollow = useToggleFollow();
  const { status: subscriptionStatus, isTrial, expiresAt, storeEnvironment, isActive } = useEntitlement({
    enabled: profileQueriesEnabled,
  });
  const { balance, credits } = useBookingCredits({ enabled: profileQueriesEnabled });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [storiesArchiveVisible, setStoriesArchiveVisible] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
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

  usePreferenceOnboardingGate(navigation);

  useLayoutEffect(() => {
    if (loading || user) return;
    const currentRoute = navigation.getState().routes[navigation.getState().index]?.name;
    if (currentRoute !== "ProfileMain") return;
    navigation.reset({ index: 0, routes: [{ name: "Auth" }] });
  }, [loading, navigation, user]);

  useEffect(() => {
    if (!isScreenFocused) return;
    return scheduleEditProfilePrefetch();
  }, [isScreenFocused]);

  const openEditProfile = useCallback(() => {
    Keyboard.dismiss();
    ensureEditProfileScreenReady();
    if (navigation.getState().routes[navigation.getState().index]?.name === "EditProfile") {
      return;
    }
    // push keeps ProfileMain under EditProfile; navigate() can pop back to an older
    // EditProfile route and leave nothing to swipe back to (canGoBack() === false).
    navigation.push("EditProfile");
  }, [navigation]);

  useEffect(() => {
    const requestedCreateStep = route.params?.openCreateStep;
    const shouldOpenCreateModal = Boolean(route.params?.openCreateModal) || Boolean(requestedCreateStep);
    if (!shouldOpenCreateModal) return;
    setCreateStep(requestedCreateStep ?? "menu");
    setCreateModalOpen(true);
    navigation.setParams({ openCreateStep: undefined, openCreateModal: undefined });
  }, [navigation, route.params?.openCreateModal, route.params?.openCreateStep]);

  const { width: windowWidth } = useWindowDimensions(); // orientation-aware by design (compact layout)
  const isCompact = windowWidth < PROFILE_COMPACT_WIDTH;
  const profileAvatarSize = resolveProfileAvatarSize(windowWidth);
  const profileAvatarStyle = useMemo(
    () => ({
      width: profileAvatarSize,
      height: profileAvatarSize,
      borderRadius: profileAvatarSize / 2,
    }),
    [profileAvatarSize],
  );
  const styles = useProfileStyles();
  const linkRowStyle = isCompact ? [styles.link, styles.linkCompact] : styles.link;
  const profileScrollRef = useRef<ScrollView>(null);

  const userName = `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || t("profile.defaultUserName");
  const isEmailVerified = Boolean(profile?.is_verified);
  const emailVerificationLabel = isEmailVerified ? t("profile.emailVerified") : t("profile.emailNotVerified");
  const verifyEmailLabel = t("profile.verifyEmail");
  const isRussianLocale = i18n.language.startsWith("ru");
  const verificationFontSize = useMemo(() => {
    if (isRussianLocale) return VERIFICATION_RU_FONT_SIZE;
    const contentPadding = isCompact ? 12 : 16;
    const rowWidth =
      windowWidth -
      contentPadding * 2 -
      PROFILE_CARD_PADDING * 2 -
      profileAvatarSize -
      PROFILE_INFO_MARGIN_LEFT;
    if (isEmailVerified) return VERIFICATION_BASE_FONT_SIZE;
    const textLength = emailVerificationLabel.length + verifyEmailLabel.length;
    const estimatedBaseWidth =
      VERIFICATION_FIXED_WIDTH + textLength * VERIFICATION_BASE_FONT_SIZE * VERIFICATION_CHAR_WIDTH_RATIO;
    if (estimatedBaseWidth <= rowWidth) return VERIFICATION_BASE_FONT_SIZE;
    const availableTextWidth = Math.max(0, rowWidth - VERIFICATION_FIXED_WIDTH);
    const nextFontSize = availableTextWidth / Math.max(1, textLength * VERIFICATION_CHAR_WIDTH_RATIO);
    return Math.max(VERIFICATION_MIN_FONT_SIZE, Math.min(VERIFICATION_BASE_FONT_SIZE, nextFontSize));
  }, [emailVerificationLabel, isCompact, isEmailVerified, isRussianLocale, profileAvatarSize, verifyEmailLabel, windowWidth]);
  const warningColor = "#f59e0b";
  const openPrivacy = () => {
    void WebBrowser.openBrowserAsync(PRIVACY_URL);
  };
  const openTerms = () => {
    void WebBrowser.openBrowserAsync(TERMS_URL);
  };
  const openDataDeletion = () => {
    navigation.navigate("DeleteAccount");
  };
  const openManageSubscription = () => {
    void Linking.openURL(Platform.OS === "ios" ? APPLE_SUBSCRIPTION_URL : GOOGLE_SUBSCRIPTION_URL);
  };

  const subscriptionLabel = useMemo(() => {
    if (!subscriptionStatus) return t("profile.subscriptionStatus.notSubscribed");
    if (subscriptionStatus === "trialing") return t("profile.subscriptionStatus.trialActive");
    if (subscriptionStatus === "active") return t("profile.subscriptionStatus.active");
    if (subscriptionStatus === "grace_period") return t("profile.subscriptionStatus.gracePeriod");
    if (subscriptionStatus === "billing_retry") return t("profile.subscriptionStatus.billingRetry");
    return t("profile.subscriptionStatus.expired");
  }, [subscriptionStatus, t]);
  const postPlaceOptions = useMemo(
    () =>
      businessCards
        .map((card) => ({
          id: card.id,
          name: card.name?.trim() || t("profile.unknownPlace"),
        }))
        .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index),
    [businessCards, t],
  );
  const createPlaceId = selectedPostPlaceId;
  const currentUserAvatar = profile?.avatar_url?.trim() || null;

  const handleSignOut = useCallback(async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      setIsSigningOut(false);
      Alert.alert(
        t("profile.alerts.signOutFailedTitle", { defaultValue: "Sign out failed" }),
        formatErrorForAlert(error, t("profile.alerts.signOutFailedBody", { defaultValue: "Please try again." })),
      );
    }
  }, [isSigningOut, signOut, t]);

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
      Alert.alert(t("profile.alerts.permissionTitle"), t("profile.alerts.permissionPhotos"));
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
      Alert.alert(t("profile.alerts.permissionTitle"), t("profile.alerts.permissionPhotos"));
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
      const uploadedUrls = await uploadPostPickerAssets(postPhotos, user?.id);
      return JSON.stringify(uploadedUrls);
    } finally {
      setUploadingPostPhotos(false);
    }
  };

  const uploadStoryPhotos = async () => {
    if (!storyPhotos.length) return null;
    setUploadingStory(true);
    try {
      const uploadedUrls = await uploadStoryPickerAssets(storyPhotos, user?.id, profileStoryPathBuilder);
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
      const created = await createPost.mutateAsync({
        placeId: createPlaceId,
        content: trimmedPostInput,
        mediaUrl,
      });
      resetPostComposer();
      goToFeedWithFocus({ postId: created.id });
    } catch (error) {
      Alert.alert(t("profile.alerts.postFailedTitle"), formatErrorForAlert(error, t("profile.alerts.postFailedBody")));
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
      const created = await createStory.mutateAsync({
        placeId: selectedStoryPlaceId,
        content: "New story",
        mediaUrl,
        expiryTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      resetPostComposer();
      goToFeedWithFocus({ storyId: created.id });
    } catch (error) {
      Alert.alert(t("profile.alerts.storyFailedTitle"), formatErrorForAlert(error, t("profile.alerts.storyFailedBody")));
    }
  };

  const handleSuggestionFollow = useCallback(
    async (item: { id: string; first_name: string | null; last_name: string | null; username: string | null }) => {
      try {
        const result = await toggleFollow.mutateAsync({ followingId: item.id, isFollowing: false });
        if (result.skipped) return;
        const displayName =
          profileFullName(item.first_name, item.last_name).trim() ||
          (item.username?.trim() ? `@${item.username.trim()}` : t("profile.defaultUserName"));
        Toast.show({
          type: "success",
          text1: t("messages.toastAddedFollowers"),
          text2: displayName,
        });
      } catch (error) {
        Toast.show({
          type: "error",
          text1: t("messages.toastFollowFailed"),
          text2: error instanceof Error ? error.message : t("messages.toastTryAgain"),
        });
      }
    },
    [t, toggleFollow],
  );

  const actions: ActionItem[] = useMemo(
    () => [
      {
        key: "subscription",
        label: isActive ? t("profile.actions.manageSubscription") : t("profile.actions.getPremium"),
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
        label: t("profile.actions.archive"),
        icon: "archive-outline",
        onPress: () => setStoriesArchiveVisible(true),
      },
      { key: "settings", label: t("profile.actions.settings"), icon: "settings-outline", onPress: openEditProfile },
      { key: "privacy", label: t("profile.actions.privacy"), icon: "shield-outline", onPress: openPrivacy },
      { key: "terms", label: t("legal.terms"), icon: "document-text-outline", onPress: openTerms },
      {
        key: "data-deletion",
        label: t("profile.actions.dataDeletion"),
        icon: "information-circle-outline",
        onPress: openDataDeletion,
      },
    ],
    [isActive, navigation, openEditProfile, openDataDeletion, openManageSubscription, openPrivacy, openTerms, t, unreadNotifications],
  );

  const showAdminDashboard = isProfileAdmin(profile?.account_role);
  const { data: moderationPendingCount = 0 } = useAdminModerationPendingCount({
    enabled: showAdminDashboard && profileQueriesEnabled,
  });
  const trailingActions = actions.slice(1);
  const showProfileSkeleton = Boolean(user) && (loading || (profileQueriesEnabled && profilePending && !profile));

  if (!loading && !user) {
    return null;
  }

  return (
    <View style={{ flex: 1 }}>
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
        <ScrollView
          ref={profileScrollRef}
          style={styles.root}
          contentContainerStyle={{
            paddingTop: 12,
            paddingBottom: SCROLL_BOTTOM_PADDING,
            paddingHorizontal: isCompact ? 12 : 16,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        >
      {showProfileSkeleton ? (
        <ProfilePageSkeleton isCompact={isCompact} />
      ) : (
        <>
      <View style={styles.card}>
        <View style={styles.profileRow}>
          <View style={[styles.avatarWrap, profileAvatarStyle]}>
            <UserAvatarImage
              uri={profile?.avatar_url}
              recyclingKey={profile?.avatar_url ?? "profile-avatar"}
              style={profileAvatarStyle}
              contentFit="cover"
              iconSize={profileAvatarSize / 2}
            />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.name}>{userName}</Text>
            <Text style={styles.email}>{profile?.email ?? user?.email}</Text>
            <View style={[styles.emailVerificationRow, styles.profileInfoFullBleed]}>
              <View
                style={[
                  styles.emailBadge,
                  {
                    borderColor: isEmailVerified ? "#22c55e" : warningColor,
                    backgroundColor: isEmailVerified ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.12)",
                  },
                ]}
              >
                <Ionicons name={isEmailVerified ? "checkmark-circle-outline" : "alert-circle-outline"} size={14} color={isEmailVerified ? "#22c55e" : warningColor} />
                <Text
                  style={[
                    styles.emailBadgeText,
                    {
                      color: isEmailVerified ? "#22c55e" : warningColor,
                      fontSize: verificationFontSize,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {emailVerificationLabel}
                </Text>
              </View>
              {!isEmailVerified ? (
                <AppPressable style={styles.verifyBtn} onPress={() => navigation.navigate("VerifyEmailOtp", { flow: "verify" })}>
                  <Text
                    style={[styles.verifyBtnText, { fontSize: verificationFontSize }]}
                    numberOfLines={1}
                  >
                    {verifyEmailLabel}
                  </Text>
                </AppPressable>
              ) : null}
            </View>
          </View>
        </View>
        <AppPressable
          style={styles.settingsBtn}
          onPressIn={ensureEditProfileScreenReady}
          onPress={openEditProfile}
        >
          <Ionicons name="settings-outline" size={16} color={colors.text} />
        </AppPressable>
        <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
          <Text style={{ color: colors.text, fontWeight: "700" }}>
            {t("profile.subscriptionTitle", { status: subscriptionLabel })}
          </Text>
          {isTrial ? <Text style={{ color: colors.textMuted, marginTop: 2 }}>{t("profile.trialInProgress")}</Text> : null}
          {expiresAt ? (
            <Text style={{ color: colors.textMuted, marginTop: 2 }}>
              {storeEnvironment === "sandbox"
                ? t("profile.expiresSandbox", {
                    date: new Date(expiresAt).toLocaleString(undefined, {
                      dateStyle: "short",
                      timeStyle: "short",
                    }),
                  })
                : t("profile.expires", { date: new Date(expiresAt).toLocaleDateString() })}
            </Text>
          ) : null}
          <BookingCreditsBadge
            balance={balance}
            isIntroActive={credits?.isIntroActive}
            hasPaidPremium={credits?.hasPaidPremium}
            introPeriodEndsAt={credits?.introPeriodEndsAt}
            style={{ marginTop: 8 }}
          />
        </View>
      </View>
      <View style={styles.statRow}>
        <AppPressable
          style={styles.statCard}
          onPress={() => navigation.navigate("Bookings", { screen: "BookingsMain" })}
          accessibilityRole="button"
          accessibilityLabel={t("profile.a11y.openBookings")}
        >
          <Text style={styles.statValue}>{bookings.length}</Text>
          <Text style={styles.statLabel}>{t("profile.stats.bookings")}</Text>
        </AppPressable>
        
        <AppPressable
          style={styles.statCard}
          onPress={() => navigation.navigate("Favorites")}
          accessibilityRole="button"
          accessibilityLabel={t("profile.a11y.openFavorites")}
        >
          <Text style={styles.statValue}>{favorites.length}</Text>
          <Text style={styles.statLabel}>{t("profile.stats.favorites")}</Text>
        </AppPressable>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>0</Text>
          <Text style={styles.statLabel}>{t("profile.stats.reviews")}</Text>
        </View>
      </View>
      <View style={styles.statRow}>
        <AppPressable
          style={styles.statCard}
          onPress={() =>
            navigation.navigate("Feed", {
              screen: "FeedMain",
              params: { filterUserId: user?.id ?? profile?.id },
            })
          }
          accessibilityRole="button"
          accessibilityLabel={t("profile.a11y.openMyPosts")}
        >
          <Text style={styles.statValue}>{postsCount}</Text>
          <Text style={styles.statLabel}>{t("profile.stats.posts")}</Text>
        </AppPressable>
        <AppPressable
          style={styles.statCard}
          onPress={() => navigation.navigate("Cart", { screen: "CartMain" })}
          accessibilityRole="button"
          accessibilityLabel={t("profile.a11y.openMessages")}
        >
          <Text style={styles.statValue}>{followersCount}</Text>
          <Text style={styles.statLabel}>{t("profile.stats.followed")}</Text>
        </AppPressable>
        <AppPressable
          style={styles.statCard}
          onPress={() => navigation.navigate("Cart", { screen: "CartMain" })}
          accessibilityRole="button"
          accessibilityLabel={t("profile.a11y.openMessages")}
        >
          <Text style={styles.statValue}>{followingCount}</Text>
          <Text style={styles.statLabel}>{t("profile.stats.following")}</Text>
        </AppPressable>
        
      </View>
      <View style={styles.suggestionsSection}>
        <View style={styles.suggestionsHeader}>
          <Text style={styles.suggestionsTitle}>{t("profile.suggestions.title")}</Text>
          <Text style={styles.suggestionsSubtitle}>{t("profile.suggestions.subtitle")}</Text>
        </View>
        <View style={styles.suggestionsContent}>
          {suggestions.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionScrollContent}>
              {suggestions.map((item) => (
                <View key={item.id} style={styles.suggestionCard}>
                  <AppPressable
                    onPress={() => navigateToPublicProfile(navigation, item.id, { viewerUserId: user?.id })}
                  >
                    <View style={styles.suggestionAvatarWrap}>
                      <UserAvatarImage
                        uri={item.avatar_url}
                        style={{ width: 66, height: 66, borderRadius: 33 }}
                        contentFit="cover"
                        iconSize={30}
                      />
                    </View>
                    <Text style={styles.suggestionName} numberOfLines={1}>
                      {profileFullName(item.first_name, item.last_name)}
                    </Text>
                    <Text style={styles.suggestionReason} numberOfLines={1}>
                      {item.reason}
                    </Text>
                  </AppPressable>
                  <AppPressable
                    style={styles.suggestionFollowBtn}
                    onPress={() => void handleSuggestionFollow(item)}
                    disabled={toggleFollow.isPending}
                  >
                    <Text style={styles.suggestionFollowBtnText}>{t("profile.suggestions.follow")}</Text>
                  </AppPressable>
                </View>
              ))}
            </ScrollView>
          ) : suggestionsLoading || suggestionsFetching ? (
            <ProfileSuggestionsSkeleton />
          ) : (
            <View style={styles.suggestionEmptyCard}>
              <View style={styles.suggestionEmptyIconWrap}>
                <Ionicons name="people-outline" size={26} color={colors.accent} />
              </View>
              <Text style={styles.suggestionEmptyTitle}>{t("profile.suggestions.emptyTitle")}</Text>
              <Text style={styles.suggestionEmptyDescription}>{t("profile.suggestions.emptyDescription")}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.bioCard}>
        <Text style={styles.bioLabel}>{t("profile.bio.label")}</Text>
        <Text style={styles.bioText}>{profile?.bio?.trim() || t("profile.bio.placeholder")}</Text>
      </View>

      <View style={styles.actionsCard}>
        {actions.slice(0, 1).map((item) => (
          <AppPressable key={item.key} style={linkRowStyle} onPress={item.onPress}>
            <Ionicons name={item.icon} size={20} color={colors.textMuted} style={styles.linkIcon} />
            <Text style={styles.linkText}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={styles.linkIcon} />
          </AppPressable>
        ))}
        <ProfileOnboardingActions
          navigation={navigation}
          hasUser={Boolean(user)}
          linkStyle={linkRowStyle}
          linkTextStyle={styles.linkText}
          linkIconStyle={styles.linkIcon}
          textMuted={colors.textMuted}
        />
        {trailingActions.map((item, index) => {
          const isLastInCard =
            !showAdminDashboard && index === trailingActions.length - 1;
          return (
            <AppPressable
              key={item.key}
              style={[linkRowStyle, isLastInCard ? styles.linkLastInCard : null]}
              onPressIn={item.key === "settings" ? ensureEditProfileScreenReady : undefined}
              onPress={item.onPress}
            >
              <Ionicons name={item.icon} size={20} color={colors.textMuted} style={styles.linkIcon} />
              <Text style={styles.linkText}>{item.label}</Text>
              {item.badgeCount != null && item.badgeCount > 0 ? (
                <View style={styles.linkMenuBadge}>
                  <Text style={styles.linkMenuBadgeText}>{item.badgeCount > 9 ? "9+" : String(item.badgeCount)}</Text>
                </View>
              ) : null}
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={styles.linkIcon} />
            </AppPressable>
          );
        })}
        {showAdminDashboard ? (
          <>
            <AppPressable
              style={linkRowStyle}
              onPress={() => navigation.navigate("AdminModeration")}
            >
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.textMuted} style={styles.linkIcon} />
              <Text style={styles.linkText}>{t("profile.adminModeration")}</Text>
              {moderationPendingCount > 0 ? (
                <View style={styles.linkMenuBadge}>
                  <Text style={styles.linkMenuBadgeText}>
                    {moderationPendingCount > 99 ? "99+" : String(moderationPendingCount)}
                  </Text>
                </View>
              ) : null}
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={styles.linkIcon} />
            </AppPressable>
            <AppPressable
              style={[linkRowStyle, styles.linkLastInCard]}
              onPress={() => navigation.navigate("AdminDashboard")}
            >
              <Ionicons name="stats-chart-outline" size={20} color={colors.textMuted} style={styles.linkIcon} />
              <Text style={styles.linkText}>{t("profile.adminDashboard")}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={styles.linkIcon} />
            </AppPressable>
          </>
        ) : null}
      </View>
      {(role === "admin" || role === "partner") && (
        <AppPressable style={[linkRowStyle, { marginTop: 10 }]} onPress={() => navigation.navigate("AdminImageUpload")}>
          <Text style={styles.linkText}>{t("profile.partnerUpload")}</Text>
        </AppPressable>
      )}
      <AppPressable
        style={[styles.signOut, isSigningOut ? { opacity: 0.6 } : null]}
        onPress={() => void handleSignOut()}
        disabled={isSigningOut}
        accessibilityRole="button"
        accessibilityLabel={t("profile.logOut")}
        accessibilityState={{ disabled: isSigningOut, busy: isSigningOut }}
      >
        {isSigningOut ? (
          <ActivityIndicator size="small" color={colors.onPrimary} />
        ) : (
          <Text style={styles.signOutText}>{t("profile.logOut")}</Text>
        )}
      </AppPressable>
        </>
      )}
    </ScrollView>

      <BottomSheetPickerModal
        visible={createModalOpen}
        onClose={closeCreateModal}
        title={
          createStep === "menu"
            ? t("profile.create.title")
            : createStep === "post"
              ? t("profile.create.postTitle")
              : t("profile.create.storyTitle")
        }
        maxHeightFraction={0.68}
      >
        {createStep === "menu" ? (
          <View style={styles.createMenuBody}>
            <View style={styles.createOptionGrid}>
              <AppPressable style={styles.createOptionCard} onPress={() => setCreateStep("post")}>
                <Ionicons name="grid-outline" size={34} color={colors.text} />
                <Text style={styles.createOptionLabel}>{t("profile.create.post")}</Text>
                <Text style={styles.createOptionHint}>{t("profile.create.postHint")}</Text>
              </AppPressable>
              <AppPressable
                style={styles.createOptionCard}
                onPress={() => {
                  setCreateStep("story");
                }}
                disabled={uploadingStory || createStory.isPending}
              >
                <Ionicons name="add-circle-outline" size={34} color={colors.text} />
                <Text style={styles.createOptionLabel}>{t("profile.create.story")}</Text>
                {uploadingStory || createStory.isPending ? (
                  <ActivityIndicator style={styles.createOptionLoading} size="small" color={colors.primary} />
                ) : (
                  <Text style={styles.createOptionHint}>{t("profile.create.storyHint")}</Text>
                )}
              </AppPressable>
            </View>
          </View>
        ) : createStep === "post" ? (
          <View style={styles.createPostSheetBody}>
            {createPost.isPending || uploadingPostPhotos ? (
              <View style={styles.createPostLoadingOnlyWrap}>
                <View style={styles.createPostLoadingWrap}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.createPostLoadingText}>
                    {uploadingPostPhotos ? t("profile.create.uploadingPhotos") : t("profile.create.publishingPost")}
                  </Text>
                </View>
              </View>
            ) : null}
            {!(createPost.isPending || uploadingPostPhotos) ? (
              <>
                <AppPressable style={styles.postUploaderBox} onPress={() => void pickPostPhotos()}>
                  <Ionicons name="images-outline" size={22} color={colors.textMuted} />
                  <Text style={styles.postUploaderText}>{t("profile.create.tapAddPhotos")}</Text>
                  <Text style={styles.postPhotoCount}>
                    {postPhotos.length
                      ? t("profile.create.photosSelected", { count: postPhotos.length, max: MAX_POST_PHOTOS })
                      : t("profile.create.photosUpTo", { max: MAX_POST_PHOTOS })}
                  </Text>
                </AppPressable>
                <Text style={styles.postRequiredHint}>{t("profile.create.requiredPost")}</Text>
                {postPhotos.length ? (
                  <View style={styles.postPhotosList}>
                    {postPhotos.map((photo) => (
                      <View key={photo.uri} style={styles.postPhotoItem}>
                        <SmartImage uri={photo.uri} style={styles.postPhotoThumb} contentFit="cover" />
                        <AppPressable
                          style={styles.postPhotoRemoveBtn}
                          onPress={() => {
                            setPostPhotos((prev) => prev.filter((item) => item.uri !== photo.uri));
                          }}
                        >
                          <Ionicons name="close" size={11} color={colors.text} />
                        </AppPressable>
                      </View>
                    ))}
                  </View>
                ) : null}
                <AppPressable
                  style={[
                    styles.postPlaceSelectTrigger,
                    postPlaceError ? styles.postPlaceSelectTriggerError : null,
                  ]}
                  onPress={() => setPostPlacePickerOpen((prev) => !prev)}
                >
                  <Text style={selectedPostPlaceId ? styles.postPlaceSelectText : styles.postPlaceSelectPlaceholder}>
                    {selectedPostPlaceId
                      ? (postPlaceOptions.find((option) => option.id === selectedPostPlaceId)?.name ??
                        t("profile.create.selectedPlace"))
                      : t("profile.create.selectPlace")}
                  </Text>
                  <Ionicons name={postPlacePickerOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
                </AppPressable>
                {postPlacePickerOpen ? (
                  <View style={styles.postPlaceOptionsWrap}>
                    {postPlaceOptions.map((option, index) => (
                      <AppPressable
                        key={option.id}
                        style={[styles.postPlaceOption, index === postPlaceOptions.length - 1 ? { borderBottomWidth: 0 } : null]}
                        onPress={() => {
                          setSelectedPostPlaceId(option.id);
                          setPostPlaceError(false);
                          setPostPlacePickerOpen(false);
                        }}
                      >
                        <Text style={styles.postPlaceOptionText}>{option.name}</Text>
                        {selectedPostPlaceId === option.id ? <Ionicons name="checkmark" size={16} color={colors.primary} /> : null}
                      </AppPressable>
                    ))}
                  </View>
                ) : null}
                <View style={styles.composerWrap}>
                  <CommentComposer
                    avatarUrl={currentUserAvatar}
                    value={postInput}
                    onChangeText={(value) => {
                      setPostInput(value);
                      if (postInputError && value.trim()) {
                        setPostInputError(false);
                      }
                    }}
                    placeholder={t("profile.create.postPlaceholder")}
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
              <View style={styles.createPostBackRow}>
                <AppPressable style={styles.createFlowBackBtn} onPress={() => setCreateStep("menu")}>
                  <Text style={styles.createFlowBackBtnText}>{t("profile.create.backToMenu")}</Text>
                </AppPressable>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.createPostSheetBody}>
            {createStory.isPending || uploadingStory ? (
              <View style={styles.createStoryLoadingOnlyWrap}>
                <View style={styles.createPostLoadingWrap}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.createPostLoadingText}>
                    {uploadingStory ? t("profile.create.uploadingPhotos") : t("profile.create.publishingStory")}
                  </Text>
                </View>
              </View>
            ) : null}
            {!(createStory.isPending || uploadingStory) ? (
              <>
                <AppPressable
                  style={[styles.postUploaderBox, storyPhotosError ? styles.postUploaderBoxError : null]}
                  onPress={() => void pickStoryPhotos()}
                >
                  <Ionicons name="images-outline" size={22} color={colors.textMuted} />
                  <Text style={styles.postUploaderText}>{t("profile.create.tapAddPhotos")}</Text>
                  <Text style={styles.postPhotoCount}>
                    {storyPhotos.length
                      ? t("profile.create.photosSelected", { count: storyPhotos.length, max: MAX_POST_PHOTOS })
                      : t("profile.create.photosUpTo", { max: MAX_POST_PHOTOS })}
                  </Text>
                </AppPressable>
                <Text style={styles.postRequiredHint}>{t("profile.create.requiredStory")}</Text>
                {storyPhotos.length ? (
                  <View style={styles.postPhotosList}>
                    {storyPhotos.map((photo) => (
                      <View key={photo.uri} style={styles.postPhotoItem}>
                        <SmartImage uri={photo.uri} style={styles.postPhotoThumb} contentFit="cover" />
                        <AppPressable
                          style={styles.postPhotoRemoveBtn}
                          onPress={() => {
                            setStoryPhotos((prev) => prev.filter((item) => item.uri !== photo.uri));
                          }}
                        >
                          <Ionicons name="close" size={11} color={colors.text} />
                        </AppPressable>
                      </View>
                    ))}
                  </View>
                ) : null}
                <AppPressable
                  style={[
                    styles.postPlaceSelectTrigger,
                    storyPlaceError ? styles.postPlaceSelectTriggerError : null,
                  ]}
                  onPress={() => setStoryPlacePickerOpen((prev) => !prev)}
                >
                  <Text style={selectedStoryPlaceId ? styles.postPlaceSelectText : styles.postPlaceSelectPlaceholder}>
                    {selectedStoryPlaceId
                      ? (postPlaceOptions.find((option) => option.id === selectedStoryPlaceId)?.name ??
                        t("profile.create.selectedPlace"))
                      : t("profile.create.selectPlace")}
                  </Text>
                  <Ionicons name={storyPlacePickerOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
                </AppPressable>
                {storyPlacePickerOpen ? (
                  <View style={styles.postPlaceOptionsWrap}>
                    {postPlaceOptions.map((option, index) => (
                      <AppPressable
                        key={option.id}
                        style={[styles.postPlaceOption, index === postPlaceOptions.length - 1 ? { borderBottomWidth: 0 } : null]}
                        onPress={() => {
                          setSelectedStoryPlaceId(option.id);
                          setStoryPlaceError(false);
                          setStoryPlacePickerOpen(false);
                        }}
                      >
                        <Text style={styles.postPlaceOptionText}>{option.name}</Text>
                        {selectedStoryPlaceId === option.id ? <Ionicons name="checkmark" size={16} color={colors.primary} /> : null}
                      </AppPressable>
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}
            {!(createStory.isPending || uploadingStory) ? (
              <View style={styles.createStoryActionsRow}>
                <AppPressable style={styles.createFlowBackBtn} onPress={() => setCreateStep("menu")}>
                  <Text style={styles.createFlowBackBtnText}>{t("profile.create.backToMenu")}</Text>
                </AppPressable>
                <AppPressable
                  style={styles.createStoryPublishBtn}
                  onPress={() => void submitStory()}
                  disabled={createStory.isPending || uploadingStory}
                >
                  <Text style={styles.createStoryPublishBtnText}>{t("profile.create.publishStory")}</Text>
                </AppPressable>
              </View>
            ) : null}
          </View>
        )}
      </BottomSheetPickerModal>

      <NotificationsSheetModal visible={notificationsOpen} onClose={() => setNotificationsOpen(false)} />

      {storiesArchiveVisible ? (
        <View style={[StyleSheet.absoluteFillObject, { zIndex: 100 }]} pointerEvents="box-none">
          <StoriesArchiveView overlayActive onRequestClose={() => setStoriesArchiveVisible(false)} />
        </View>
      ) : null}
    </View>
  );
}

export default function ProfileScreen() {
  return <ProfileScreenContent />;
}