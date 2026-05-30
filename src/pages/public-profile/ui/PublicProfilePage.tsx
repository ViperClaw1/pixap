import { useCallback, useEffect, useMemo } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { CommonActions, useNavigation, useRoute, type NavigationProp, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { useAuth } from "@/app/providers/AuthProvider";
import type { BrowseFlowParamList, CartStackParamList, RootTabParamList } from "@/app/navigation/types";
import {
  getCurrentRootTabName,
  getTabMainScreen,
  navigateToMessageThread,
  navigateToProfileAuth,
  navigateToRootTabScreen,
} from "@/app/navigation/navigationHelpers";
import { useMyFollowing, usePublicProfile, useToggleFollow } from "@/entities/user";
import { AppPressable } from "@/shared/ui/app-pressable";
import { UserAvatarImage } from "@/shared/ui/user-avatar-image";
import { UgcModerationOverflow } from "@/features/ugc-moderation";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";
import { devWarn } from "@/shared/lib/devLog";
import { useAndroidFullSwipeBackPanHandlers } from "@/shared/lib/useAndroidFullSwipeBackPanHandlers";
import { useAndroidHardwareBack } from "@/shared/lib/useAndroidHardwareBack";
import { profileFullName } from "@/pages/profile/model/format";
import { publicProfileStaticStyles, publicProfileThemeStyles } from "./publicProfileStyles";

type PublicProfileRoute = RouteProp<BrowseFlowParamList | CartStackParamList, "PublicProfile">;
type PublicProfileNav = NativeStackNavigationProp<
  BrowseFlowParamList | CartStackParamList,
  "PublicProfile"
>;

export default function PublicProfilePage() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<PublicProfileNav>();
  const rootNavigation = useNavigation<NavigationProp<RootTabParamList>>();
  const route = useRoute<PublicProfileRoute>();
  const userId = route.params.userId.trim();
  const { user } = useAuth();
  const themed = useThemeStyles(({ colors: c }) => publicProfileThemeStyles(c));
  const styles = useMemo(() => mergeStaticAndThemed(publicProfileStaticStyles, themed), [themed]);
  const { data: profile, isLoading, isError, refetch } = usePublicProfile(userId);
  const { followingSet } = useMyFollowing();
  const toggleFollow = useToggleFollow();

  const isOwnProfile = Boolean(user?.id && user.id === userId);
  const isFollowing = followingSet.has(userId);
  const displayName = profile ? profileFullName(profile.first_name, profile.last_name) : t("common.unknownUser");
  const usernameLabel = profile?.username?.trim()
    ? `@${profile.username.trim()}`
    : `@${t("common.unknownUser")}`;

  useEffect(() => {
    if (!isOwnProfile) return;
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
    rootNavigation.dispatch(
      CommonActions.navigate({
        name: "Profile",
        params: { screen: "ProfileMain" },
      }),
    );
  }, [isOwnProfile, navigation, rootNavigation]);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    const tab = getCurrentRootTabName(navigation);
    if (tab) {
      navigateToRootTabScreen(navigation, { tab, screen: getTabMainScreen(tab) });
      return;
    }
    navigateToRootTabScreen(navigation, { tab: "Feed", screen: "FeedMain" });
  }, [navigation]);

  const androidSwipeBackPanHandlers = useAndroidFullSwipeBackPanHandlers(
    useMemo(
      () => ({
        goBack,
        canGoBack: () => true,
      }),
      [goBack],
    ),
  );

  useAndroidHardwareBack(goBack);

  const runAuthedAction = useCallback(
    (action: () => void) => {
      if (!user) {
        navigateToProfileAuth(navigation);
        return;
      }
      action();
    },
    [navigation, user],
  );

  const onToggleFollow = useCallback(() => {
    runAuthedAction(() => {
      void toggleFollow
        .mutateAsync({ followingId: userId, isFollowing })
        .catch((error) => {
          devWarn("public profile toggle follow failed", error);
          Toast.show({
            type: "error",
            text1: t("messages.toastFollowFailed"),
            text2: error instanceof Error ? error.message : t("messages.toastTryAgain"),
          });
        });
    });
  }, [isFollowing, runAuthedAction, t, toggleFollow, userId]);

  const onMessage = useCallback(() => {
    runAuthedAction(() => {
      navigateToMessageThread(navigation, {
        threadId: "",
        peerId: userId,
        peerFirstName: profile?.first_name,
        peerLastName: profile?.last_name,
        peerAvatarUrl: profile?.avatar_url,
      });
    });
  }, [navigation, profile, runAuthedAction, userId]);

  if (isOwnProfile) {
    return (
      <View style={[styles.screen, styles.centerState]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} {...androidSwipeBackPanHandlers}>
      <View style={styles.header}>
        <AppPressable style={styles.backBtn} onPress={goBack}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </AppPressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {t("publicProfile.title")}
        </Text>
        {userId ? (
          <UgcModerationOverflow
            subject={{
              targetType: "user",
              reportedUserId: userId,
              authorLabel: displayName,
            }}
          />
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : isError || !profile ? (
        <View style={styles.centerState}>
          <Text style={styles.centerStateText}>{t("publicProfile.notFound")}</Text>
          <AppPressable style={styles.retryBtn} onPress={() => void refetch()}>
            <Text style={styles.retryBtnText}>{t("publicProfile.retry")}</Text>
          </AppPressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <UserAvatarImage uri={profile.avatar_url} style={styles.avatar} contentFit="cover" iconSize={40} />
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.username}>{usernameLabel}</Text>
          </View>

          <View style={styles.actionsRow}>
            <AppPressable
              style={[
                styles.actionBtn,
                isFollowing ? styles.followBtnActive : styles.followBtnInactive,
              ]}
              onPress={onToggleFollow}
              disabled={toggleFollow.isPending}
            >
              <Text
                style={[
                  styles.actionBtnText,
                  isFollowing ? styles.followBtnTextActive : styles.followBtnTextInactive,
                ]}
              >
                {isFollowing ? t("publicProfile.following") : t("publicProfile.follow")}
              </Text>
            </AppPressable>
            <AppPressable
              style={[styles.actionBtn, styles.messageBtn]}
              onPress={onMessage}
            >
              <Text style={[styles.actionBtnText, styles.messageBtnText]}>{t("publicProfile.message")}</Text>
            </AppPressable>
          </View>

          <View style={[styles.bioCard, { marginTop: 20 }]}>
            <Text style={styles.bioLabel}>{t("profile.bio.label")}</Text>
            <Text style={styles.bioText}>{profile.bio?.trim() || t("profile.bio.placeholder")}</Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}
