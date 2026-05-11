import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import Toast from "react-native-toast-message";
import { ShimmerProvider, ShimmerSurface } from "@/shared/ui/shimmer";
import { useMyFollowing, useToggleFollow } from "@/entities/user";
import { usePublicProfiles } from "@/entities/user";
import { useMarkThreadRead, useMessagesInbox, useOpenOrCreateThread, usePeopleToFollow } from "@/entities/messages";
import type { CartStackParamList } from "@/navigation/types";
import { AppHeader } from "@/shared/ui/app-header/AppHeader";
import { BottomSheetPickerModal } from "@/shared/ui/bottom-sheet-picker/BottomSheetPickerModal";

function fullName(first?: string | null, last?: string | null, emptyLabel = "Unknown user") {
  return `${first?.trim() ?? ""} ${last?.trim() ?? ""}`.trim() || emptyLabel;
}

function formatRelativeTime(value: string) {
  const createdAtMs = new Date(value).getTime();
  if (Number.isNaN(createdAtMs)) return "";
  const diffSeconds = Math.max(0, Math.floor((Date.now() - createdAtMs) / 1000));
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

const SKELETON_IDS = ["1", "2", "3"] as const;

export default function MessagesPage() {
  const { t } = useTranslation();
  const unknownLabel = t("common.unknownUser");
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
  const toggleFollow = useToggleFollow();

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
        console.warn("toggle follow failed", error);
        Toast.show({
          type: "error",
          text1: t("messages.toastFollowFailed"),
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
    void openOrCreateThread
      .mutateAsync(person.id)
      .then((result) => {
        setStartChatModalOpen(false);
        navigation.navigate("MessageThread", {
          threadId: result.threadId,
          peerId: person.id,
          peerFirstName: person.first_name,
          peerLastName: person.last_name,
          peerAvatarUrl: person.avatar_url,
        });
      })
      .catch((error) => {
        console.warn("open chat failed", error);
        Toast.show({
          type: "error",
          text1: t("messages.toastCouldNotOpenChat"),
          text2: error instanceof Error ? error.message : t("messages.toastTryAgain"),
        });
      });
  };

  const visibleThreads = useMemo(
    () => threads.filter((thread) => !deletedThreadIds.has(thread.thread_id)),
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

  const stylesThemed = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          backgroundColor: colors.background,
        },
  
        content: {
          paddingTop: 12,
          paddingHorizontal: 16,
          paddingBottom: Math.max(insets.bottom, 20),
        },
  
        // SEARCH
        searchWrap: {
          marginTop: 14,
          height: 48,
          borderRadius: 14,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 14,
  
          // modern shadow instead of border
          shadowColor: "#000",
          shadowOpacity: 0.02,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        },
  
        searchInput: {
          flex: 1,
          color: colors.text,
          fontSize: 15,
          marginLeft: 8,
        },
  
        // SECTION
        sectionHeader: {
          marginTop: 22,
          marginBottom: 10,
        },
  
        sectionTitle: {
          color: colors.text,
          fontSize: 18,
          fontWeight: "700",
          letterSpacing: -0.2,
        },
  
        // CARD
        card: {
          borderRadius: 16,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 11,
          marginBottom: 9,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
  
          // modern soft elevation
          shadowColor: "#000",
          shadowOpacity: 0.02,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 1,
        },
  
        avatar: {
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: colors.surface,
        },
  
        cardMain: {
          flex: 1,
          justifyContent: "center",
        },
  
        rowBetween: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        },
  
        title: {
          color: colors.text,
          fontSize: 15,
          fontWeight: "700",
          letterSpacing: -0.1,
        },
  
        chatTitle: {
          flex: 1,
        },
  
        subtitle: {
          marginTop: 4,
          color: colors.textMuted,
          fontSize: 13,
          lineHeight: 16,
        },
  
        time: {
          color: colors.textMuted,
          fontSize: 12,
          fontWeight: "600",
        },
  
        username: {
          marginTop: 2,
          color: colors.textMuted,
          fontSize: 12,
        },
        userMetaRow: {
          marginTop: 2,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        },
        followedBadge: {
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 999,
          backgroundColor: "rgba(236,101,68,0.14)",
          borderWidth: 1,
          borderColor: "#ec6544",
        },
        followedBadgeText: {
          color: "#ec6544",
          fontSize: 10,
          fontWeight: "700",
          letterSpacing: 0.2,
          textTransform: "uppercase",
        },
  
        // ACTIONS
        actionsWrap: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        },
        threadActionsWrap: {
          marginLeft: 8,
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 4,
        },
        threadReadIndicator: {
          minHeight: 16,
          alignItems: "center",
          justifyContent: "center",
        },
  
        iconActionBtn: {
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
  
          backgroundColor: colors.surface,
  
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        },
  
        followBtn: {
          backgroundColor: "#ec6544",
          borderWidth: 1,
          borderColor: "#ec6544",
        },
  
        chatBtn: {
          backgroundColor: "#333333",
          borderWidth: 1,
          borderColor: "#ec6544",
        },

        // SWIPE
        swipeActionWrap: {
          justifyContent: "center",
          paddingLeft: 8,
        },
        swipeActionBtn: {
          width: 52,
          height: 52,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOpacity: 0.12,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 3,
        },
        swipeFollowBtn: {
          backgroundColor: "#ec6544",
        },
        swipeChatBtn: {
          backgroundColor: "#333333",
        },
        swipeDeleteBtn: {
          backgroundColor: "#d64545",
        },
  
        // SKELETON
        skeletonWrap: {
          gap: 10,
        },
        skeletonCard: {
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          borderRadius: 14,
          overflow: "hidden",
          backgroundColor: colors.card,
          padding: 12,
          paddingBottom: 12,
          marginBottom: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        },
  
        skeletonAvatar: {
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: colors.surface,
        },
  
        skeletonMain: {
          flex: 1,
          gap: 8,
        },
  
        skeletonLineLg: {
          height: 12,
          width: "65%",
          borderRadius: 10,
          backgroundColor: colors.surface,
        },
  
        skeletonLineMd: {
          height: 10,
          width: "45%",
          borderRadius: 10,
          backgroundColor: colors.surface,
          opacity: 0.7,
        },
        skeletonActions: {
          flexDirection: "row",
          gap: 10,
          marginLeft: "auto",
        },
  
        skeletonCircle: {
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: colors.surface,
        },
  
        // EMPTY
        empty: {
          color: colors.textMuted,
          fontSize: 13,
          textAlign: "center",
          marginTop: 14,
        },
      }),
    [colors, insets.bottom],
  );

  return (
    <ScrollView style={stylesThemed.root} contentContainerStyle={stylesThemed.content}>
      <AppHeader
        title={t("header.messages")}
        leftIcon="add"
        onLeftPress={() => setStartChatModalOpen(true)}
        rightIcon={mode === "dark" ? "sunny-outline" : "moon-outline"}
        onRightPress={toggleThemeMode}
      />

      <View style={stylesThemed.searchWrap}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t("messages.searchPlaceholder")}
          placeholderTextColor={colors.textMuted}
          style={stylesThemed.searchInput}
        />
      </View>

      <View style={stylesThemed.sectionHeader}>
        <Text style={stylesThemed.sectionTitle}>{t("messages.myChats")}</Text>
      </View>
      {isPageLoading ? (
        <ShimmerProvider active>
          <View style={stylesThemed.skeletonWrap}>
            {SKELETON_IDS.map((id) => (
              <View key={`inbox-skeleton-${id}`} style={stylesThemed.skeletonCard}>
                <ShimmerSurface width={48} height={48} borderRadius={24} isDark={mode === "dark"} />
                <View style={stylesThemed.skeletonMain}>
                  <ShimmerSurface width={160} height={12} borderRadius={10} isDark={mode === "dark"} />
                  <ShimmerSurface width={110} height={10} borderRadius={10} isDark={mode === "dark"} />
                </View>
              </View>
            ))}
          </View>
        </ShimmerProvider>
      ) : visibleThreads.length ? (
        <FlatList
          data={visibleThreads}
          keyExtractor={(thread) => thread.thread_id}
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
                <View style={stylesThemed.swipeActionWrap}>
                  <Pressable
                    style={[stylesThemed.swipeActionBtn, stylesThemed.swipeDeleteBtn]}
                    onPress={() => onDeleteThread(thread.thread_id, thread.last_sender_name || unknownLabel)}
                  >
                    <Ionicons name="trash-outline" size={22} color="#ffffff" />
                  </Pressable>
                </View>
              )}
            >
              <Pressable
                style={stylesThemed.card}
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
                <SmartImage uri={thread.last_sender_avatar_url} style={stylesThemed.avatar} contentFit="cover" />
                <View style={stylesThemed.cardMain}>
                  <View style={stylesThemed.rowBetween}>
                    <Text style={[stylesThemed.title, stylesThemed.chatTitle]} numberOfLines={1}>
                      {thread.last_sender_name}
                    </Text>
                  </View>
                  <Text style={stylesThemed.subtitle} numberOfLines={1} ellipsizeMode="tail">
                    {thread.last_message_text}
                  </Text>
                </View>
                <View style={stylesThemed.threadActionsWrap}>
                  <Text style={stylesThemed.time}>{formatRelativeTime(thread.last_message_at)}</Text>
                  <View style={stylesThemed.threadReadIndicator}>
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
        <Text style={stylesThemed.empty}>{t("messages.noChatsFound")}</Text>
      )}

      <View style={stylesThemed.sectionHeader}>
        <Text style={stylesThemed.sectionTitle}>{t("messages.peopleToFollow")}</Text>
      </View>
      {isPageLoading ? (
        <ShimmerProvider active>
          <View style={stylesThemed.skeletonWrap}>
            {SKELETON_IDS.map((id) => (
              <View key={`people-skeleton-${id}`} style={stylesThemed.skeletonCard}>
                <ShimmerSurface width={48} height={48} borderRadius={24} isDark={mode === "dark"} />
                <View style={stylesThemed.skeletonMain}>
                  <ShimmerSurface width={160} height={12} borderRadius={10} isDark={mode === "dark"} />
                  <ShimmerSurface width={110} height={10} borderRadius={10} isDark={mode === "dark"} />
                </View>
                <View style={stylesThemed.skeletonActions}>
                  <ShimmerSurface width={44} height={44} borderRadius={22} isDark={mode === "dark"} />
                  <ShimmerSurface width={44} height={44} borderRadius={22} isDark={mode === "dark"} />
                </View>
              </View>
            ))}
          </View>
        </ShimmerProvider>
      ) : people.length ? (
        <FlatList
          data={people}
          keyExtractor={(person) => person.id}
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
                <View style={stylesThemed.swipeActionWrap}>
                  <Pressable style={[stylesThemed.swipeActionBtn, stylesThemed.swipeChatBtn]} onPress={() => onOpenChat(person)}>
                    <Ionicons name="chatbubble-ellipses" size={22} color="#ffffff" />
                  </Pressable>
                </View>
              )}
              renderLeftActions={() => (
                <View style={stylesThemed.swipeActionWrap}>
                  <Pressable style={[stylesThemed.swipeActionBtn, stylesThemed.swipeFollowBtn]} onPress={() => onToggleFollower(person)}>
                    <Ionicons name={followingSet.has(person.id) ? "person-remove" : "person-add"} size={22} color="#ffffff" />
                  </Pressable>
                </View>
              )}
            >
              <View style={stylesThemed.card}>
                <SmartImage uri={person.avatar_url} style={stylesThemed.avatar} contentFit="cover" />
                <View style={stylesThemed.cardMain}>
                  <Text style={stylesThemed.title} numberOfLines={1}>
                    {fullName(person.first_name, person.last_name, unknownLabel)}
                  </Text>
                  <View style={stylesThemed.userMetaRow}>
                    <Text style={stylesThemed.username} numberOfLines={1}>
                      @{person.username?.trim() || unknownLabel}
                    </Text>
                    {followingSet.has(person.id) ? (
                      <View style={stylesThemed.followedBadge}>
                        <Text style={stylesThemed.followedBadgeText}>{t("messages.followed")}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={stylesThemed.actionsWrap}>
                  <Pressable style={[stylesThemed.iconActionBtn, stylesThemed.followBtn]} onPress={() => onToggleFollower(person)}>
                    <Ionicons name={followingSet.has(person.id) ? "person-remove" : "person-add"} size={22} color="#ffffff" />
                  </Pressable>
                  <Pressable style={[stylesThemed.iconActionBtn, stylesThemed.chatBtn]} onPress={() => onOpenChat(person)}>
                    <Ionicons name="chatbubble-ellipses" size={22} color="#ffffff" />
                  </Pressable>
                </View>
              </View>
            </Swipeable>
          )}
        />
      ) : (
        <Text style={stylesThemed.empty}>{t("messages.noUsersFound")}</Text>
      )}

      <BottomSheetPickerModal visible={startChatModalOpen} onClose={() => setStartChatModalOpen(false)} title={t("messages.startChatTitle")}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: Math.max(insets.bottom, 12), gap: 10 }}>
          {publicProfilesLoading ? (
            <Text style={stylesThemed.empty}>{t("common.loading")}</Text>
          ) : publicProfiles.filter((profile) => profile.id !== user?.id).length ? (
            publicProfiles
              .filter((profile) => profile.id !== user?.id)
              .map((item) => (
                <View key={item.id} style={stylesThemed.card}>
                  <SmartImage uri={item.avatar_url} style={stylesThemed.avatar} contentFit="cover" />
                  <View style={stylesThemed.cardMain}>
                    <Text style={stylesThemed.title} numberOfLines={1}>
                      {fullName(item.first_name, item.last_name, unknownLabel)}
                    </Text>
                    <Text style={stylesThemed.username} numberOfLines={1}>
                      @{item.username?.trim() || unknownLabel}
                    </Text>
                  </View>
                  <Pressable style={[stylesThemed.iconActionBtn, stylesThemed.chatBtn]} onPress={() => onOpenChat(item)}>
                    <Ionicons name="chatbubble-ellipses" size={20} color="#ffffff" />
                  </Pressable>
                </View>
              ))
          ) : (
            <Text style={stylesThemed.empty}>{t("messages.noUsersFound")}</Text>
          )}
        </ScrollView>
      </BottomSheetPickerModal>
    </ScrollView>
  );
}
