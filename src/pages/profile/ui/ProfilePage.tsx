import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Linking,
  Platform,
  Alert,
  useWindowDimensions,
} from "react-native";
import { useNavigation, useRoute, useIsFocused, type RouteProp } from "@react-navigation/native";
import type { CompositeNavigationProp } from "@react-navigation/native";
import { useBottomTabBarHeight, type BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/app/providers/AuthProvider";
import { useProfile, useUserRole, isProfileAdmin } from "@/entities/user";
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
import { PROFILE_COMPACT_WIDTH, useProfileStyles } from "./profileStyles";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { UserAvatarImage } from "@/shared/ui/user-avatar-image";
import { useEntitlement } from "@/entities/subscription";
import { useBookingCredits } from "@/entities/booking-credits";
import { usePreferenceOnboardingGate } from "@/features/preference-onboarding";
import { ProfileBookingCreditsBadge } from "./ProfileBookingCreditsBadge";
import { ProfileOnboardingActions } from "./ProfileOnboardingActions";
import { BottomSheetPickerModal } from "@/shared/ui/bottom-sheet-picker/BottomSheetPickerModal";
import { CommentComposer } from "@/shared/ui/comment-composer/CommentComposer";
import { AppHeader } from "@/shared/ui/app-header/AppHeader";
import { NotificationsSheetModal } from "@/shared/ui/notifications-sheet";
import { profileStoryPathBuilder, uploadPostPickerAssets, uploadStoryPickerAssets } from "@/entities/story/lib/uploadStoriesBucketMedia";
import { primaryPressableStyle, primaryPressableTextStyle } from "@/shared/theme/primaryPressable";
import type { ThemeMode } from "@/app/providers/ThemeProvider";
import {
  APPLE_SUBSCRIPTION_URL,
  GOOGLE_SUBSCRIPTION_URL,
  MAX_POST_PHOTOS,
  PRIVACY_URL,
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
  const isScreenFocused = useIsFocused();
  const profileQueriesEnabled = !!user && isScreenFocused;
  const { data: profile } = useProfile({ enabled: profileQueriesEnabled });
  const unreadNotifications = useUnreadCount({ enabled: profileQueriesEnabled });
  const { data: favorites = [] } = useFavorites({ enabled: profileQueriesEnabled });
  const { data: bookings = [] } = useBookings({ enabled: profileQueriesEnabled });
  const { data: businessCards = [] } = useBusinessCards(undefined, undefined, { enabled: profileQueriesEnabled });
  const { role } = useUserRole({ enabled: profileQueriesEnabled });
  const { postsCount, followersCount, followingCount } = useProfileSocialMetrics({ enabled: profileQueriesEnabled });
  const { suggestions } = useSuggestedProfiles(12, { enabled: profileQueriesEnabled });
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

  useEffect(() => {
    if (!loading && !user) {
      navigation.navigate("Auth");
    }
  }, [loading, user, navigation]);

  usePreferenceOnboardingGate(navigation);

  useEffect(() => {
    if (!isScreenFocused) return;
    return scheduleEditProfilePrefetch();
  }, [isScreenFocused]);

  const openEditProfile = useCallback(() => {
    ensureEditProfileScreenReady();
    navigation.navigate("EditProfile");
  }, [navigation]);

  useEffect(() => {
    const requestedCreateStep = route.params?.openCreateStep;
    const shouldOpenCreateModal = Boolean(route.params?.openCreateModal) || Boolean(requestedCreateStep);
    if (!shouldOpenCreateModal) return;
    setCreateStep(requestedCreateStep ?? "menu");
    setCreateModalOpen(true);
    navigation.setParams({ openCreateStep: undefined, openCreateModal: undefined });
  }, [navigation, route.params?.openCreateModal, route.params?.openCreateStep]);

  const { width: windowWidth } = useWindowDimensions();
  const tabBarHeight = useBottomTabBarHeight();
  const isCompact = windowWidth < PROFILE_COMPACT_WIDTH;
  const styles = useProfileStyles();
  const linkRowStyle = isCompact ? [styles.link, styles.linkCompact] : styles.link;
  const scrollBottomPadding =
    Platform.OS === "android" ? Math.max(insets.bottom, 24) + tabBarHeight : Math.max(insets.bottom, 24);

  const userName = `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || t("profile.defaultUserName");
  const isEmailVerified = Boolean(profile?.is_verified);
  const warningColor = "#f59e0b";
  const openPrivacy = () => {
    void Linking.openURL(PRIVACY_URL);
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
      { key: "privacy", label: t("profile.actions.privacy"), icon: "shield-outline", onPress: openPrivacy },
      { key: "settings", label: t("profile.actions.settings"), icon: "settings-outline", onPress: openEditProfile },
    ],
    [isActive, navigation, openEditProfile, openManageSubscription, openPrivacy, t, unreadNotifications],
  );

  const showAdminDashboard = isProfileAdmin(profile?.account_role);
  const trailingActions = actions.slice(1);

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
        style={styles.root}
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: scrollBottomPadding,
          paddingHorizontal: isCompact ? 12 : 16,
        }}
        keyboardShouldPersistTaps="handled"
      >
      <View style={styles.card}>
        <View style={styles.profileRow}>
          <View style={styles.avatarWrap}>
            <UserAvatarImage
              uri={profile?.avatar_url}
              recyclingKey={profile?.avatar_url ?? "profile-avatar"}
              style={{ width: 56, height: 56, borderRadius: 28 }}
              contentFit="cover"
              iconSize={28}
            />
          </View>
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.name}>{userName}</Text>
            <Text style={styles.email}>{profile?.email ?? user?.email}</Text>
            <View style={styles.emailVerificationRow}>
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
                <Text style={[styles.emailBadgeText, { color: isEmailVerified ? "#22c55e" : warningColor }]}>
                  {isEmailVerified ? t("profile.emailVerified") : t("profile.emailNotVerified")}
                </Text>
              </View>
              {!isEmailVerified ? (
                <Pressable style={styles.verifyBtn} onPress={() => navigation.navigate("VerifyEmailOtp", { flow: "verify" })}>
                  <Text style={styles.verifyBtnText}>{t("profile.verifyEmail")}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          <Pressable
            style={styles.settingsBtn}
            onPressIn={ensureEditProfileScreenReady}
            onPress={openEditProfile}
          >
            <Ionicons name="settings-outline" size={16} color={colors.text} />
          </Pressable>
        </View>
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
          <ProfileBookingCreditsBadge balance={balance} credits={credits} />
        </View>
      </View>
      <View style={styles.statRow}>
        <Pressable
          style={styles.statCard}
          onPress={() => navigation.navigate("Bookings", { screen: "BookingsMain" })}
          accessibilityRole="button"
          accessibilityLabel={t("profile.a11y.openBookings")}
        >
          <Text style={styles.statValue}>{bookings.length}</Text>
          <Text style={styles.statLabel}>{t("profile.stats.bookings")}</Text>
        </Pressable>
        
        <Pressable
          style={styles.statCard}
          onPress={() => navigation.navigate("Favorites")}
          accessibilityRole="button"
          accessibilityLabel={t("profile.a11y.openFavorites")}
        >
          <Text style={styles.statValue}>{favorites.length}</Text>
          <Text style={styles.statLabel}>{t("profile.stats.favorites")}</Text>
        </Pressable>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>0</Text>
          <Text style={styles.statLabel}>{t("profile.stats.reviews")}</Text>
        </View>
      </View>
      <View style={styles.statRow}>
        <Pressable
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
        </Pressable>
        <Pressable
          style={styles.statCard}
          onPress={() => navigation.navigate("Cart", { screen: "CartMain" })}
          accessibilityRole="button"
          accessibilityLabel={t("profile.a11y.openMessages")}
        >
          <Text style={styles.statValue}>{followersCount}</Text>
          <Text style={styles.statLabel}>{t("profile.stats.followed")}</Text>
        </Pressable>
        <Pressable
          style={styles.statCard}
          onPress={() => navigation.navigate("Cart", { screen: "CartMain" })}
          accessibilityRole="button"
          accessibilityLabel={t("profile.a11y.openMessages")}
        >
          <Text style={styles.statValue}>{followingCount}</Text>
          <Text style={styles.statLabel}>{t("profile.stats.following")}</Text>
        </Pressable>
        
      </View>
      <View style={styles.suggestionsSection}>
        <View style={styles.suggestionsHeader}>
          <Text style={styles.suggestionsTitle}>{t("profile.suggestions.title")}</Text>
          <Text style={styles.suggestionsSubtitle}>{t("profile.suggestions.subtitle")}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionScrollContent}>
          {suggestions.length ? (
            suggestions.map((item) => (
              <View key={item.id} style={styles.suggestionCard}>
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
                <Pressable
                  style={styles.suggestionFollowBtn}
                  onPress={() => void toggleFollow.mutateAsync({ followingId: item.id, isFollowing: false })}
                  disabled={toggleFollow.isPending}
                >
                  <Text style={styles.suggestionFollowBtnText}>{t("profile.suggestions.follow")}</Text>
                </Pressable>
              </View>
            ))
          ) : (
            <View style={[styles.suggestionCard, { width: 220 }]}>
              <Text style={styles.suggestionReason}>{t("profile.suggestions.empty")}</Text>
            </View>
          )}
        </ScrollView>
      </View>
      <View style={styles.bioCard}>
        <Text style={styles.bioLabel}>{t("profile.bio.label")}</Text>
        <Text style={styles.bioText}>{profile?.bio?.trim() || t("profile.bio.placeholder")}</Text>
      </View>

      <View style={styles.actionsCard}>
        {actions.slice(0, 1).map((item) => (
          <Pressable key={item.key} style={linkRowStyle} onPress={item.onPress}>
            <Ionicons name={item.icon} size={20} color={colors.textMuted} style={styles.linkIcon} />
            <Text style={styles.linkText}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={styles.linkIcon} />
          </Pressable>
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
            <Pressable
              key={item.key}
              style={[linkRowStyle, isLastInCard ? styles.linkLastInCard : null]}
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
            </Pressable>
          );
        })}
        {showAdminDashboard ? (
          <Pressable
            style={[linkRowStyle, styles.linkLastInCard]}
            onPress={() => navigation.navigate("AdminDashboard")}
          >
            <Ionicons name="stats-chart-outline" size={20} color={colors.textMuted} style={styles.linkIcon} />
            <Text style={styles.linkText}>{t("profile.adminDashboard")}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={styles.linkIcon} />
          </Pressable>
        ) : null}
      </View>
      {(role === "admin" || role === "partner") && (
        <Pressable style={[linkRowStyle, { marginTop: 10 }]} onPress={() => navigation.navigate("AdminImageUpload")}>
          <Text style={styles.linkText}>{t("profile.partnerUpload")}</Text>
        </Pressable>
      )}
      <Pressable
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
      </Pressable>
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
              <Pressable style={styles.createOptionCard} onPress={() => setCreateStep("post")}>
                <Ionicons name="grid-outline" size={34} color={colors.text} />
                <Text style={styles.createOptionLabel}>{t("profile.create.post")}</Text>
                <Text style={styles.createOptionHint}>{t("profile.create.postHint")}</Text>
              </Pressable>
              <Pressable
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
              </Pressable>
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
                <Pressable style={styles.postUploaderBox} onPress={() => void pickPostPhotos()}>
                  <Ionicons name="images-outline" size={22} color={colors.textMuted} />
                  <Text style={styles.postUploaderText}>{t("profile.create.tapAddPhotos")}</Text>
                  <Text style={styles.postPhotoCount}>
                    {postPhotos.length
                      ? t("profile.create.photosSelected", { count: postPhotos.length, max: MAX_POST_PHOTOS })
                      : t("profile.create.photosUpTo", { max: MAX_POST_PHOTOS })}
                  </Text>
                </Pressable>
                <Text style={styles.postRequiredHint}>{t("profile.create.requiredPost")}</Text>
                {postPhotos.length ? (
                  <View style={styles.postPhotosList}>
                    {postPhotos.map((photo) => (
                      <View key={photo.uri} style={styles.postPhotoItem}>
                        <SmartImage uri={photo.uri} style={styles.postPhotoThumb} contentFit="cover" />
                        <Pressable
                          style={styles.postPhotoRemoveBtn}
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
                </Pressable>
                {postPlacePickerOpen ? (
                  <View style={styles.postPlaceOptionsWrap}>
                    {postPlaceOptions.map((option, index) => (
                      <Pressable
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
                      </Pressable>
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
                <Pressable style={styles.createFlowBackBtn} onPress={() => setCreateStep("menu")}>
                  <Text style={styles.createFlowBackBtnText}>{t("profile.create.backToMenu")}</Text>
                </Pressable>
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
                <Pressable
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
                </Pressable>
                <Text style={styles.postRequiredHint}>{t("profile.create.requiredStory")}</Text>
                {storyPhotos.length ? (
                  <View style={styles.postPhotosList}>
                    {storyPhotos.map((photo) => (
                      <View key={photo.uri} style={styles.postPhotoItem}>
                        <SmartImage uri={photo.uri} style={styles.postPhotoThumb} contentFit="cover" />
                        <Pressable
                          style={styles.postPhotoRemoveBtn}
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
                </Pressable>
                {storyPlacePickerOpen ? (
                  <View style={styles.postPlaceOptionsWrap}>
                    {postPlaceOptions.map((option, index) => (
                      <Pressable
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
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}
            {!(createStory.isPending || uploadingStory) ? (
              <View style={styles.createStoryActionsRow}>
                <Pressable style={styles.createFlowBackBtn} onPress={() => setCreateStep("menu")}>
                  <Text style={styles.createFlowBackBtnText}>{t("profile.create.backToMenu")}</Text>
                </Pressable>
                <Pressable
                  style={styles.createStoryPublishBtn}
                  onPress={() => void submitStory()}
                  disabled={createStory.isPending || uploadingStory}
                >
                  <Text style={styles.createStoryPublishBtnText}>{t("profile.create.publishStory")}</Text>
                </Pressable>
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