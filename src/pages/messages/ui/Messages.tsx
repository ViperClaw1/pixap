import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { useAuth } from "@/app/providers/AuthProvider";
import { UserAvatarImage } from "@/shared/ui/user-avatar-image";
import Toast from "react-native-toast-message";
import { ShimmerProvider, ShimmerSurface } from "@/shared/ui/shimmer";
import { useMyFollowing, useToggleFollow } from "@/entities/user";
import { usePublicProfiles } from "@/entities/user";
import {
  findDirectThreadForPeer,
  findSupportThread,
  useMarkThreadRead,
  useMessagesInbox,
  useOpenOrCreateSupportThread,
  useOpenOrCreateThread,
  usePeopleToFollow,
} from "@/entities/messages";
import { SupportChatCard } from "./SupportChatCard";
import type { CartStackParamList } from "@/app/navigation/types";
import { AppHeader } from "@/shared/ui/app-header/AppHeader";
import { BottomSheetPickerModal } from "@/shared/ui/bottom-sheet-picker/BottomSheetPickerModal";
import { MESSAGES_COMPACT_WIDTH, useMessagesStyles } from "./messagesStyles";
import { FLASH_LIST_ESTIMATED_SIZE } from "@/shared/lib/flashListEstimatedSizes";
import { devWarn } from "@/shared/lib/devLog";
import { formatRelativeTime } from "@/shared/lib/formatRelativeTime";

function fullName(first?: string | null, last?: string | null, emptyLabel = "Unknown user") {
  return `${first?.trim() ?? ""} ${last?.trim() ?? ""}`.trim() || emptyLabel;
}

const SKELETON_IDS = ["1", "2", "3"] as const;

export default function MessagesPage() {
  const { t } = useTranslation();
  const unknownLabel = t("common.unknownUser");
  const { width: windowWidth } = useWindowDimensions();
  const isCompact = windowWidth < MESSAGES_COMPACT_WIDTH;
  const actionIconSize = isCompact ? 18 : 22;
  const navigation = useNavigation<NativeStackNavigationProp<CartStackParamList>>();
  const insets = useSafeAreaInsets();
  const { colors, mode, setMode } = useAppTheme();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [startChatModalOpen, setStartChatModalOpen] = useState(false);
  const [deletedThreadIds, setDeletedThreadIds] = useState<Set<string>>(new Set());
  const { threads, isLoading: inboxLoading } = useMessagesInbox(search);
  const { people, isLoading: peopleLoading } = usePeopleToFollow(search);
  const { data: publicProfiles = [], isLoading: publicProfilesLoading } = usePublicProfiles("");
  const { followingSet } = useMyFollowing();
  const isPageLoading = inboxLoading || peopleLoading;
  const markThreadRead = useMarkThreadRead();
  const openOrCreateThread = useOpenOrCreateThread();
  const openOrCreateSupportThread = useOpenOrCreateSupportThread();
  const toggleFollow = useToggleFollow();
  const supportThread = useMemo(() => findSupportThread(threads), [threads]);

  const toggleThemeMode = () => {
    setMode(mode === "dark" ? "light" : "dark");
  };

  const onToggleFollower = (person: (typeof people)[number]) => {
    const isFollowing = followingSet.has(person.id);
    void toggleFollow
      .mutateAsync({ followingId: person.id, isFollowing })
      .then((result) => {
        if (result.skipped) return;
        Toast.show({
          type: "success",
          text1: result.nowFollowing ? t("messages.toastAddedFollowers") : t("messages.toastRemovedFollowers"),
          text2: `@${person.username?.trim() || unknownLabel}`,
        });
      })
      .catch((error) => {
        devWarn("toggle follow failed", error);
        Toast.show({
          type: "error",
          text1: t("messages.toastFollowFailed"),
          text2: error instanceof Error ? error.message : t("messages.toastTryAgain"),
        });
      });
  };

  const navigateToThread = (
    threadId: string,
    person: {
      id: string;
      first_name?: string | null;
      last_name?: string | null;
      avatar_url?: string | null;
    },
  ) => {
    navigation.navigate("MessageThread", {
      threadId,
      peerId: person.id,
      peerFirstName: person.first_name,
      peerLastName: person.last_name,
      peerAvatarUrl: person.avatar_url,
    });
  };

  const navigateToSupportThread = (threadId: string) => {
    navigation.navigate("MessageThread", {
      threadId,
      peerId: "",
      isSupport: true,
      threadTitle: t("messages.support"),
    });
  };

  const onOpenSupport = () => {
    if (supportThread) {
      navigateToSupportThread(supportThread.thread_id);
      return;
    }

    void openOrCreateSupportThread
      .mutateAsync()
      .then((result) => navigateToSupportThread(result.threadId))
      .catch((error) => {
        devWarn("open support chat failed", error);
        Toast.show({
          type: "error",
          text1: t("messages.toastCouldNotOpenSupport"),
          text2: error instanceof Error ? error.message : t("messages.toastTryAgain"),
        });
      });
  };

  const onOpenChat = (person: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    avatar_url?: string | null;
  }) => {
    const existingThreadId = findDirectThreadForPeer(threads, person.id);
    if (existingThreadId) {
      setStartChatModalOpen(false);
      navigateToThread(existingThreadId, person);
      return;
    }

    void openOrCreateThread
      .mutateAsync(person.id)
      .then((result) => {
        setStartChatModalOpen(false);
        navigateToThread(result.threadId, person);
      })
      .catch((error) => {
        devWarn("open chat failed", error);
        Toast.show({
          type: "error",
          text1: t("messages.toastCouldNotOpenChat"),
          text2: error instanceof Error ? error.message : t("messages.toastTryAgain"),
        });
      });
  };

  const visibleThreads = useMemo(
    () => threads.filter((thread) => !thread.is_support && !deletedThreadIds.has(thread.thread_id)),
    [deletedThreadIds, threads],
  );

  const onDeleteThread = (threadId: string, title: string) => {
    Alert.alert(t("messages.deleteChatTitle"), t("messages.deleteChatMessage", { name: title }), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => {
          setDeletedThreadIds((prev) => {
            const next = new Set(prev);
            next.add(threadId);
            return next;
          });
          Toast.show({
            type: "success",
            text1: t("messages.toastChatDeleted"),
            text2: t("messages.toastChatRemoved", { title }),
          });
        },
      },
    ]);
  };

  const styles = useMessagesStyles(insets.bottom);

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, isCompact ? styles.contentCompact : null]}>
      <AppHeader
        title={t("header.messages")}
        leftIcon="add"
        onLeftPress={() => setStartChatModalOpen(true)}
        rightIcon={mode === "dark" ? "sunny-outline" : "moon-outline"}
        onRightPress={toggleThemeMode}
        notificationsEnabled
      />

      <SupportChatCard
        styles={styles}
        colors={colors}
        isCompact={isCompact}
        isOpening={openOrCreateSupportThread.isPending}
        existingThread={supportThread}
        onPress={onOpenSupport}
      />

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t("messages.searchPlaceholder")}
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
        />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t("messages.myChats")}</Text>
      </View>
      {isPageLoading ? (
        <ShimmerProvider active>
          <View style={styles.skeletonWrap}>
            {SKELETON_IDS.map((id) => (
              <View key={`inbox-skeleton-${id}`} style={styles.skeletonCard}>
                <ShimmerSurface width={48} height={48} borderRadius={24} />
                <View style={styles.skeletonMain}>
                  <ShimmerSurface width={160} height={12} borderRadius={10} />
                  <ShimmerSurface width={110} height={10} borderRadius={10} />
                </View>
              </View>
            ))}
          </View>
        </ShimmerProvider>
      ) : visibleThreads.length ? (
        <FlashList
          data={visibleThreads}
          keyExtractor={(thread) => thread.thread_id}
          estimatedItemSize={FLASH_LIST_ESTIMATED_SIZE.messageRow}
          scrollEnabled={false}
          removeClippedSubviews
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={6}
          updateCellsBatchingPeriod={40}
          renderItem={({ item: thread }) => (
            <Swipeable
              overshootRight={false}
              renderRightActions={() => (
                <View style={styles.swipeActionWrap}>
                  <Pressable
                    style={[styles.swipeActionBtn, styles.swipeDeleteBtn]}
                    onPress={() => onDeleteThread(thread.thread_id, thread.last_sender_name || unknownLabel)}
                  >
                    <Ionicons name="trash-outline" size={22} color={colors.onAccent} />
                  </Pressable>
                </View>
              )}
            >
              <Pressable
                style={[styles.card, isCompact ? styles.cardCompact : null]}
                onPress={() => {
                  if (thread.unread_count && !markThreadRead.isPending) {
                    void markThreadRead.mutateAsync(thread.thread_id);
                  }
                  const peer = thread.participants.find((participant) => participant.id !== user?.id) ?? thread.participants[0];
                  navigation.navigate("MessageThread", {
                    threadId: thread.thread_id,
                    peerId: peer?.id ?? thread.last_sender_id,
                    peerFirstName: peer?.first_name ?? null,
                    peerLastName: peer?.last_name ?? null,
                    peerAvatarUrl: peer?.avatar_url ?? thread.last_sender_avatar_url,
                  });
                }}
              >
                <UserAvatarImage
                  uri={thread.last_sender_avatar_url}
                  style={[styles.avatar, isCompact ? styles.avatarCompact : null]}
                  contentFit="cover"
                />
                <View style={styles.cardMain}>
                  <View style={styles.rowBetween}>
                    <Text style={[styles.title, styles.chatTitle]} numberOfLines={1}>
                      {thread.last_sender_name}
                    </Text>
                  </View>
                  <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">
                    {thread.last_message_text}
                  </Text>
                </View>
                <View style={styles.threadActionsWrap}>
                  <Text style={styles.time}>
                    {formatRelativeTime(thread.last_message_at, { style: "compact" })}
                  </Text>
                  <View style={styles.threadReadIndicator}>
                    <Ionicons
                      name={thread.unread_count > 0 ? "checkmark" : "checkmark-done"}
                      size={16}
                      color={thread.unread_count > 0 ? colors.textMuted : colors.primary}
                    />
                  </View>
                </View>
              </Pressable>
            </Swipeable>
          )}
        />
      ) : (
        <Text style={styles.empty}>{t("messages.noChatsFound")}</Text>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t("messages.peopleToFollow")}</Text>
      </View>
      {isPageLoading ? (
        <ShimmerProvider active>
          <View style={styles.skeletonWrap}>
            {SKELETON_IDS.map((id) => (
              <View key={`people-skeleton-${id}`} style={[styles.skeletonCard, isCompact ? styles.skeletonCardCompact : null]}>
                <ShimmerSurface
                  width={isCompact ? 40 : 48}
                  height={isCompact ? 40 : 48}
                  borderRadius={isCompact ? 20 : 24}
                 
                />
                <View style={styles.skeletonMain}>
                  <ShimmerSurface width={160} height={12} borderRadius={10} />
                  <ShimmerSurface width={110} height={10} borderRadius={10} />
                </View>
                <View style={styles.skeletonActions}>
                  <ShimmerSurface
                    width={isCompact ? 36 : 44}
                    height={isCompact ? 36 : 44}
                    borderRadius={isCompact ? 18 : 22}
                   
                  />
                  <ShimmerSurface
                    width={isCompact ? 36 : 44}
                    height={isCompact ? 36 : 44}
                    borderRadius={isCompact ? 18 : 22}
                   
                  />
                </View>
              </View>
            ))}
          </View>
        </ShimmerProvider>
      ) : people.length ? (
        <FlashList
          data={people}
          keyExtractor={(person) => person.id}
          estimatedItemSize={FLASH_LIST_ESTIMATED_SIZE.messageRow}
          scrollEnabled={false}
          removeClippedSubviews
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={6}
          updateCellsBatchingPeriod={40}
          renderItem={({ item: person }) => (
            <Swipeable
              overshootRight={false}
              renderRightActions={() => (
                <View style={styles.swipeActionWrap}>
                  <Pressable
                    style={[styles.swipeActionBtn, styles.swipeChatBtn, isCompact ? styles.swipeActionBtnCompact : null]}
                    onPress={() => onOpenChat(person)}
                  >
                    <Ionicons name="chatbubble-ellipses" size={actionIconSize} color={colors.onAccent} />
                  </Pressable>
                </View>
              )}
              renderLeftActions={() => (
                <View style={styles.swipeActionWrap}>
                  <Pressable
                    style={[styles.swipeActionBtn, styles.swipeFollowBtn, isCompact ? styles.swipeActionBtnCompact : null]}
                    onPress={() => onToggleFollower(person)}
                  >
                    <Ionicons
                      name={followingSet.has(person.id) ? "person-remove" : "person-add"}
                      size={actionIconSize}
                      color={colors.onAccent}
                    />
                  </Pressable>
                </View>
              )}
            >
              <View style={[styles.card, isCompact ? styles.cardCompact : null]}>
                <UserAvatarImage
                  uri={person.avatar_url}
                  style={[styles.avatar, isCompact ? styles.avatarCompact : null]}
                  contentFit="cover"
                />
                <View style={styles.cardMain}>
                  <Text style={[styles.title, isCompact ? styles.titleCompact : null]} numberOfLines={1}>
                    {fullName(person.first_name, person.last_name, unknownLabel)}
                  </Text>
                  <View style={[styles.userMetaRow, isCompact ? styles.userMetaRowCompact : null]}>
                    <Text style={[styles.username, isCompact ? styles.usernameCompact : null]} numberOfLines={1}>
                      @{person.username?.trim() || unknownLabel}
                    </Text>
                    {followingSet.has(person.id) ? (
                      <View style={[styles.followedBadge, isCompact ? styles.followedBadgeCompact : null]}>
                        <Text style={[styles.followedBadgeText, isCompact ? styles.followedBadgeTextCompact : null]}>
                          {t("messages.followed")}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={[styles.actionsWrap, isCompact ? styles.actionsWrapCompact : null]}>
                  <Pressable
                    style={[styles.iconActionBtn, styles.followBtn, isCompact ? styles.iconActionBtnCompact : null]}
                    onPress={() => onToggleFollower(person)}
                  >
                    <Ionicons
                      name={followingSet.has(person.id) ? "person-remove" : "person-add"}
                      size={actionIconSize}
                      color={colors.onAccent}
                    />
                  </Pressable>
                  <Pressable
                    style={[styles.iconActionBtn, styles.chatBtn, isCompact ? styles.iconActionBtnCompact : null]}
                    onPress={() => onOpenChat(person)}
                  >
                    <Ionicons name="chatbubble-ellipses" size={actionIconSize} color={colors.onAccent} />
                  </Pressable>
                </View>
              </View>
            </Swipeable>
          )}
        />
      ) : (
        <Text style={styles.empty}>{t("messages.noUsersFound")}</Text>
      )}

      <BottomSheetPickerModal visible={startChatModalOpen} onClose={() => setStartChatModalOpen(false)} title={t("messages.startChatTitle")}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: Math.max(insets.bottom, 12), gap: 10 }}>
          {publicProfilesLoading ? (
            <Text style={styles.empty}>{t("common.loading")}</Text>
          ) : publicProfiles.filter((profile) => profile.id !== user?.id).length ? (
            publicProfiles
              .filter((profile) => profile.id !== user?.id)
              .map((item) => (
                <View key={item.id} style={[styles.card, isCompact ? styles.cardCompact : null]}>
                  <UserAvatarImage
                    uri={item.avatar_url}
                    style={[styles.avatar, isCompact ? styles.avatarCompact : null]}
                    contentFit="cover"
                  />
                  <View style={styles.cardMain}>
                    <Text style={[styles.title, isCompact ? styles.titleCompact : null]} numberOfLines={1}>
                      {fullName(item.first_name, item.last_name, unknownLabel)}
                    </Text>
                    <Text style={[styles.username, isCompact ? styles.usernameCompact : null]} numberOfLines={1}>
                      @{item.username?.trim() || unknownLabel}
                    </Text>
                  </View>
                  <Pressable
                    style={[styles.iconActionBtn, styles.chatBtn, isCompact ? styles.iconActionBtnCompact : null]}
                    onPress={() => onOpenChat(item)}
                  >
                    <Ionicons name="chatbubble-ellipses" size={isCompact ? 18 : 20} color={colors.onAccent} />
                  </Pressable>
                </View>
              ))
          ) : (
            <Text style={styles.empty}>{t("messages.noUsersFound")}</Text>
          )}
        </ScrollView>
      </BottomSheetPickerModal>
    </ScrollView>
  );
}
