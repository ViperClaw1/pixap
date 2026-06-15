import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, InteractionManager, Platform, Text, TextInput, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { FlashList } from "@shopify/flash-list";
import { useKeyboardInset } from "@/shared/lib/keyboard";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { useAuth } from "@/app/providers/AuthProvider";
import Toast from "react-native-toast-message";
import { ShimmerProvider, ShimmerSurface } from "@/shared/ui/shimmer";
import { isProfileAdmin, useMyFollowing, useProfile, useToggleFollow, usePublicProfiles } from "@/entities/user";
import {
  findCustomerSupportTickets,
  findDirectThreadForPeer,
  findSupportThread,
  prefetchDirectThread,
  prefetchThreadMessages,
  useMarkThreadRead,
  useMessagesInbox,
  useMessagesInboxTyping,
  useOpenOrCreateSupportThread,
  usePeopleToFollow,
} from "@/entities/messages";
import type { FollowSuggestion } from "@/entities/messages/api/usePeopleToFollow";
import type { MessageThreadItem } from "@/shared/model/types/messages";
import { SupportChatCard } from "./SupportChatCard";
import { SupportTicketsSection } from "./SupportTicketsSection";
import { navigateToPublicProfile } from "@/app/navigation/navigationHelpers";
import type { CartStackParamList } from "@/app/navigation/types";
import { AppHeader } from "@/shared/ui/app-header/AppHeader";
import { BottomSheetPickerModal } from "@/shared/ui/bottom-sheet-picker/BottomSheetPickerModal";
import { MESSAGES_COMPACT_WIDTH, useMessagesStyles } from "./messagesStyles";
import { FLASH_LIST_ESTIMATED_SIZE } from "@/shared/lib/flashListEstimatedSizes";
import { devWarn } from "@/shared/lib/devLog";
import { markMessagingPerfEnd, markMessagingPerfStart } from "@/shared/lib/messagingPerf";
import { MessagesThreadRow } from "./MessagesThreadRow";
import { MessagesPersonRow } from "./MessagesPersonRow";
import { StartChatUserRow } from "./StartChatUserRow";
import { scheduleMessagesScreensPrefetch } from "../lib/prefetchMessagesScreen";
import { useMessagesListSwipeable } from "../lib/useMessagesListSwipeable";
import { useNavigateOnce } from "@/shared/lib/navigation/useNavigateOnce";

const SKELETON_IDS = ["1", "2", "3"] as const;

type MessagesListRow =
  | { kind: "sections-loading"; key: string }
  | { kind: "section"; key: string; title: string }
  | { kind: "thread"; key: string; thread: MessageThreadItem }
  | { kind: "person"; key: string; person: FollowSuggestion };

type MessagesSectionsSkeletonProps = {
  styles: ReturnType<typeof useMessagesStyles>;
  isCompact: boolean;
  chatsTitle: string;
  peopleTitle: string;
};

function MessagesSectionsSkeleton({ styles, isCompact, chatsTitle, peopleTitle }: MessagesSectionsSkeletonProps) {
  return (
    <ShimmerProvider active>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{chatsTitle}</Text>
      </View>
      {SKELETON_IDS.map((id) => (
        <View key={`inbox-skeleton-${id}`} style={[styles.card, isCompact ? styles.cardCompact : null]}>
          <ShimmerSurface
            width={isCompact ? 40 : 48}
            height={isCompact ? 40 : 48}
            borderRadius={isCompact ? 20 : 24}
          />
          <View style={styles.cardMain}>
            <ShimmerSurface width={isCompact ? 132 : 160} height={15} borderRadius={8} />
            <ShimmerSurface
              width={isCompact ? 96 : 112}
              height={13}
              borderRadius={8}
              style={styles.skeletonSubtitleLine}
            />
          </View>
          <View style={styles.threadActionsWrap}>
            <ShimmerSurface width={36} height={12} borderRadius={6} />
            <ShimmerSurface width={16} height={16} borderRadius={8} />
          </View>
        </View>
      ))}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{peopleTitle}</Text>
      </View>
      {SKELETON_IDS.map((id) => (
        <View key={`people-skeleton-${id}`} style={[styles.card, isCompact ? styles.cardCompact : null]}>
          <ShimmerSurface
            width={isCompact ? 40 : 48}
            height={isCompact ? 40 : 48}
            borderRadius={isCompact ? 20 : 24}
          />
          <View style={styles.cardMain}>
            <ShimmerSurface width={isCompact ? 132 : 160} height={15} borderRadius={8} />
            <ShimmerSurface
              width={isCompact ? 88 : 104}
              height={12}
              borderRadius={8}
              style={styles.skeletonUsernameLine}
            />
          </View>
          <View style={[styles.actionsWrap, isCompact ? styles.actionsWrapCompact : null]}>
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
    </ShimmerProvider>
  );
}

export default function MessagesPage() {
  const { t } = useTranslation();
  const unknownLabel = t("common.unknownUser");
  const { width: windowWidth } = useWindowDimensions(); // orientation-aware by design (compact layout)
  const isCompact = windowWidth < MESSAGES_COMPACT_WIDTH;
  const actionIconSize = isCompact ? 18 : 22;
  const navigation = useNavigation<NativeStackNavigationProp<CartStackParamList>>();
  const navigateOnce = useNavigateOnce();
  const isScreenFocused = useIsFocused();
  const { handleSwipeableOpen, handleSwipeableClose, closeOpenSwipeable } = useMessagesListSwipeable();
  const [inboxEffectsReady, setInboxEffectsReady] = useState(false);
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { colors, mode, setMode } = useAppTheme();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const viewerIsSupportStaff = isProfileAdmin(profile?.account_role);
  const [search, setSearch] = useState("");
  const [startChatModalOpen, setStartChatModalOpen] = useState(false);
  const [startChatSearch, setStartChatSearch] = useState("");
  const [deletedThreadIds, setDeletedThreadIds] = useState<Set<string>>(new Set());
  const { threads, isPending: inboxPending } = useMessagesInbox(search);
  const { people, isPending: peoplePending } = usePeopleToFollow(search, { enabled: inboxEffectsReady });
  const peoplePendingEffective = !inboxEffectsReady || peoplePending;
  const sectionsPending = inboxPending || peoplePendingEffective;
  const { data: publicProfiles = [], isLoading: publicProfilesLoading } = usePublicProfiles(
    startChatSearch,
    startChatModalOpen,
  );
  const { followingSet } = useMyFollowing();
  const markThreadRead = useMarkThreadRead();
  const openOrCreateSupportThread = useOpenOrCreateSupportThread();
  const toggleFollow = useToggleFollow();
  const supportThread = useMemo(() => findSupportThread(threads, user?.id), [threads, user?.id]);
  const customerSupportTickets = useMemo(
    () => findCustomerSupportTickets(threads, user?.id),
    [threads, user?.id],
  );

  useEffect(() => {
    markMessagingPerfStart("inbox_open");
    const cancelPrefetch = scheduleMessagesScreensPrefetch();
    const task = InteractionManager.runAfterInteractions(() => setInboxEffectsReady(true));
    return () => {
      cancelPrefetch();
      task.cancel();
    };
  }, []);

  useEffect(() => {
    if (!sectionsPending) {
      markMessagingPerfEnd("inbox_open", `${threads.length} threads`);
    }
  }, [sectionsPending, threads.length]);

  useEffect(() => {
    if (!isScreenFocused) {
      closeOpenSwipeable();
    }
  }, [closeOpenSwipeable, isScreenFocused]);

  const startChatCandidates = useMemo(
    () => publicProfiles.filter((profile) => profile.id !== user?.id),
    [publicProfiles, user?.id],
  );

  const closeStartChatModal = useCallback(() => {
    setStartChatModalOpen(false);
    setStartChatSearch("");
  }, []);

  const toggleThemeMode = () => {
    setMode(mode === "dark" ? "light" : "dark");
  };

  const onToggleFollower = (person: FollowSuggestion) => {
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

  const navigateToThread = useCallback(
    (
      threadId: string,
      person: {
        id: string;
        first_name?: string | null;
        last_name?: string | null;
        avatar_url?: string | null;
      },
    ) => {
      navigateOnce(() => {
        navigation.navigate("MessageThread", {
          threadId,
          peerId: person.id,
          peerFirstName: person.first_name,
          peerLastName: person.last_name,
          peerAvatarUrl: person.avatar_url,
        });
      });
    },
    [navigateOnce, navigation],
  );

  const navigateToSupportThread = useCallback(
    (threadId: string) => {
      navigateOnce(() => {
        navigation.navigate("MessageThread", {
          threadId,
          peerId: "",
          isSupport: true,
          threadTitle: t("messages.support"),
        });
      });
    },
    [navigateOnce, navigation, t],
  );

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

  const onOpenChat = useCallback(
    (person: FollowSuggestion) => {
      const existingThreadId = findDirectThreadForPeer(threads, person.id);
      closeStartChatModal();
      navigateToThread(existingThreadId ?? "", person);
      if (!existingThreadId) {
        void prefetchDirectThread(queryClient, person.id, user?.id);
      }
    },
    [closeStartChatModal, navigateToThread, queryClient, threads, user?.id],
  );

  const onPrefetchChat = useCallback(
    (person: FollowSuggestion) => {
      if (findDirectThreadForPeer(threads, person.id)) return;
      void prefetchDirectThread(queryClient, person.id, user?.id);
    },
    [queryClient, threads, user?.id],
  );

  const visibleThreads = useMemo(
    () =>
      threads.filter((thread) => {
        if (deletedThreadIds.has(thread.thread_id)) return false;
        return !thread.is_support;
      }),
    [deletedThreadIds, threads],
  );
  const typingThreadIds = useMessagesInboxTyping(
    viewerIsSupportStaff ? customerSupportTickets : visibleThreads,
    user?.id,
    isScreenFocused && inboxEffectsReady,
  );
  const peerTypingLabel = t("messages.thread.peerTyping");

  const chatsSectionTitle = t("messages.myChats");
  const peopleSectionTitle = t("messages.peopleToFollow");

  const listRows = useMemo((): MessagesListRow[] => {
    if (sectionsPending) {
      return [{ kind: "sections-loading", key: "sections-loading" }];
    }
    const rows: MessagesListRow[] = [{ kind: "section", key: "section-chats", title: chatsSectionTitle }];
    for (const thread of visibleThreads) {
      rows.push({ kind: "thread", key: thread.thread_id, thread });
    }
    rows.push({ kind: "section", key: "section-people", title: peopleSectionTitle });
    for (const person of people) {
      rows.push({ kind: "person", key: person.id, person });
    }
    return rows;
  }, [chatsSectionTitle, people, peopleSectionTitle, sectionsPending, visibleThreads]);

  const onDeleteThread = useCallback(
    (threadId: string, title: string) => {
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
    },
    [t],
  );

  const openThread = useCallback(
    (thread: MessageThreadItem) => {
      const customerId = thread.support_user_id;
      const isCustomerSupport =
        thread.is_support && viewerIsSupportStaff && customerId && customerId !== user?.id;
      const peer = isCustomerSupport
        ? (thread.participants.find((participant) => participant.id === customerId) ?? null)
        : (thread.participants.find((participant) => participant.id !== user?.id) ?? thread.participants[0]);
      navigateToThread(thread.thread_id, {
        id: peer?.id ?? thread.last_sender_id,
        first_name: peer?.first_name ?? null,
        last_name: peer?.last_name ?? null,
        avatar_url: peer?.avatar_url ?? thread.last_sender_avatar_url,
      });
      if (thread.unread_count && !markThreadRead.isPending) {
        InteractionManager.runAfterInteractions(() => {
          void markThreadRead.mutateAsync(thread.thread_id);
        });
      }
    },
    [markThreadRead, navigateToThread, user?.id, viewerIsSupportStaff],
  );

  const prefetchThread = useCallback(
    (threadId: string) => {
      if (!user?.id) return;
      void prefetchThreadMessages(queryClient, threadId, user.id, viewerIsSupportStaff);
    },
    [queryClient, user?.id, viewerIsSupportStaff],
  );

  const tabBarHeight = useBottomTabBarHeight();
  const styles = useMessagesStyles(insets.bottom);
  const keyboardInset = useKeyboardInset({
    bottomInset: insets.bottom,
    gap: 0,
    enabled: Platform.OS === "ios",
  });
  const listKeyboardFooterStyle = useAnimatedStyle(() => ({
    height: keyboardInset.value,
  }));
  const listKeyboardFooter = useCallback(() => {
    if (Platform.OS === "android") return null;
    return <Animated.View style={listKeyboardFooterStyle} />;
  }, [listKeyboardFooterStyle]);

  const listContentStyle = useMemo(
    () => [
      styles.content,
      isCompact ? styles.contentCompact : null,
      // FlashList on Android adds tab-bar clearance on top of safe-area padding from theme.
      Platform.OS === "android" ? { paddingBottom: tabBarHeight + 12 } : null,
    ],
    [isCompact, styles.content, styles.contentCompact, tabBarHeight],
  );

  const listHeader = useMemo(
    () => (
      <>
        {viewerIsSupportStaff ? (
          <SupportTicketsSection
            styles={styles}
            colors={colors}
            isCompact={isCompact}
            tickets={customerSupportTickets}
            typingThreadIds={typingThreadIds}
            typingLabel={peerTypingLabel}
            onOpenTicket={openThread}
            onPrefetchTicket={prefetchThread}
          />
        ) : (
          <SupportChatCard
            styles={styles}
            colors={colors}
            isCompact={isCompact}
            isOpening={openOrCreateSupportThread.isPending}
            existingThread={supportThread}
            onPress={onOpenSupport}
          />
        )}
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
      </>
    ),
    [
      colors,
      customerSupportTickets,
      isCompact,
      openOrCreateSupportThread.isPending,
      openThread,
      peerTypingLabel,
      prefetchThread,
      styles,
      supportThread,
      search,
      typingThreadIds,
      viewerIsSupportStaff,
      t,
    ],
  );

  const keyExtractor = useCallback((row: MessagesListRow) => row.key, []);
  const getItemType = useCallback((row: MessagesListRow) => row.kind, []);

  const renderItem = useCallback(
    ({ item }: { item: MessagesListRow }) => {
      if (item.kind === "sections-loading") {
        return (
          <MessagesSectionsSkeleton
            styles={styles}
            isCompact={isCompact}
            chatsTitle={chatsSectionTitle}
            peopleTitle={peopleSectionTitle}
          />
        );
      }

      if (item.kind === "section") {
        return (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{item.title}</Text>
            </View>
            {item.key === "section-chats" && !visibleThreads.length ? (
              <Text style={styles.empty}>{t("messages.noChatsFound")}</Text>
            ) : null}
            {item.key === "section-people" && !people.length ? (
              <Text style={styles.empty}>{t("messages.noUsersFound")}</Text>
            ) : null}
          </View>
        );
      }

      if (item.kind === "thread") {
        return (
          <MessagesThreadRow
            thread={item.thread}
            viewerId={user?.id ?? ""}
            styles={styles}
            colors={colors}
            isCompact={isCompact}
            peerIsTyping={typingThreadIds.has(item.thread.thread_id)}
            typingLabel={peerTypingLabel}
            onPress={() => openThread(item.thread)}
            onPressIn={() => prefetchThread(item.thread.thread_id)}
            onDelete={() => onDeleteThread(item.thread.thread_id, item.thread.last_sender_name || unknownLabel)}
            onSwipeableOpen={handleSwipeableOpen}
            onSwipeableClose={handleSwipeableClose}
          />
        );
      }

      return (
        <MessagesPersonRow
          person={item.person}
          styles={styles}
          colors={colors}
          isCompact={isCompact}
          actionIconSize={actionIconSize}
          unknownLabel={unknownLabel}
          isFollowing={followingSet.has(item.person.id)}
          followedLabel={t("messages.followed")}
          onOpenChat={() => onOpenChat(item.person)}
          onPrefetchChat={() => onPrefetchChat(item.person)}
          onToggleFollow={() => onToggleFollower(item.person)}
          onPressProfile={() =>
            navigateToPublicProfile(navigation, item.person.id, { viewerUserId: user?.id })
          }
          onSwipeableOpen={handleSwipeableOpen}
          onSwipeableClose={handleSwipeableClose}
        />
      );
    },
    [
      actionIconSize,
      colors,
      followingSet,
      isCompact,
      onDeleteThread,
      onOpenChat,
      onPrefetchChat,
      onToggleFollower,
      handleSwipeableClose,
      handleSwipeableOpen,
      openThread,
      peerTypingLabel,
      people.length,
      prefetchThread,
      chatsSectionTitle,
      peopleSectionTitle,
      styles,
      t,
      typingThreadIds,
      unknownLabel,
      user?.id,
      visibleThreads.length,
    ],
  );

  const listEmpty = useMemo(() => {
    if (sectionsPending) return null;
    if (!visibleThreads.length && !people.length) {
      return <Text style={styles.empty}>{t("messages.noChatsFound")}</Text>;
    }
    return null;
  }, [people.length, sectionsPending, styles.empty, t, visibleThreads.length]);

  return (
    <View style={styles.root}>
      <AppHeader
        title={t("header.messages")}
        leftIcon="add"
        onLeftPress={() => setStartChatModalOpen(true)}
        rightIcon={mode === "dark" ? "sunny-outline" : "moon-outline"}
        onRightPress={toggleThemeMode}
        notificationsEnabled
      />
      <FlashList
        style={{ flex: 1 }}
        data={listRows}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        estimatedItemSize={FLASH_LIST_ESTIMATED_SIZE.messageRow}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listKeyboardFooter}
        ListEmptyComponent={listEmpty}
        renderItem={renderItem}
        contentContainerStyle={listContentStyle}
        onScrollBeginDrag={closeOpenSwipeable}
        onMomentumScrollBegin={closeOpenSwipeable}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={7}
        updateCellsBatchingPeriod={40}
      />

      <BottomSheetPickerModal
        visible={startChatModalOpen}
        onClose={closeStartChatModal}
        title={t("messages.startChatTitle")}
        maxHeightFraction={0.5}
        minHeightFraction={0.5}
        fitContent
      >
        <View style={{ paddingHorizontal: 12, paddingBottom: Math.max(insets.bottom, 12), gap: 10 }}>
          <View style={[styles.searchWrap, { marginTop: 0 }]}>
            <Ionicons name="search-outline" size={18} color={colors.textMuted} />
            <TextInput
              value={startChatSearch}
              onChangeText={setStartChatSearch}
              placeholder={t("messages.startChatSearchPlaceholder")}
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
          </View>
          {publicProfilesLoading ? (
            <Text style={styles.empty}>{t("common.loading")}</Text>
          ) : startChatCandidates.length ? (
            <View style={styles.startChatList}>
              {startChatCandidates.map((item) => (
                <StartChatUserRow
                  key={item.id}
                  person={item}
                  styles={styles}
                  isCompact={isCompact}
                  unknownLabel={unknownLabel}
                  onPress={() => onOpenChat(item)}
                  onPressIn={() => onPrefetchChat(item)}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.empty}>{t("messages.noUsersFound")}</Text>
          )}
        </View>
      </BottomSheetPickerModal>
    </View>
  );
}
