import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  Pressable,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type TextInput,
} from "react-native";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { RichTextarea } from "@/shared/ui/rich-textarea/RichTextarea";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  useDeleteMessage,
  useDebouncedMarkThreadRead,
  useEditMessage,
  useMessageThreadTyping,
  useReactToMessage,
  useResolvedMessageThreadId,
  useSendMessage,
  useThreadMessages,
} from "@/entities/messages";
import { useIsUserOnline } from "@/entities/user-presence";
import { navigateFeedFocusStory, navigateFeedPlaceDetail } from "@/app/navigation/appNavigation";
import type { CartStackParamList } from "@/app/navigation/types";
import Toast from "react-native-toast-message";
import { useAndroidFullSwipeBackPanHandlers } from "@/shared/lib/useAndroidFullSwipeBackPanHandlers";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { KeyboardStickyView, useKeyboardInset } from "@/shared/lib/keyboard";
import {
  COMPOSER_HEIGHT,
  FOOTER_VERTICAL_PADDING,
  MESSAGE_THREAD_ANDROID_KEYBOARD_TRIM_PX,
  MESSAGE_THREAD_KEYBOARD_GAP,
} from "@/shared/lib/messageThreadLayout";
import { COMMENT_STICKERS } from "@/shared/constants/commentStickers";
import { peerFullName } from "../model/format";
import { resolvePeerPresenceStatus } from "../model/peerPresenceStatus";
import { useMessageThreadListRows } from "../model/useMessageThreadListRows";
import type { MessageThreadListRow } from "../model/types";
import { useMessageThreadStyles } from "@/shared/theme/messageThreadStyles";
import { FLASH_LIST_ESTIMATED_SIZE } from "@/shared/lib/flashListEstimatedSizes";
import { markMessagingPerfEnd, markMessagingPerfStart } from "@/shared/lib/messagingPerf";
import { MessageThreadRow } from "./MessageThreadRow";
import { MessageThreadSkeleton } from "./MessageThreadSkeleton";
import { ThreadHeader } from "./ThreadHeader";
import {
  AttachmentViewerModal,
  detectAttachmentKind,
  type MessageAttachmentDraft,
} from "@/features/message-attachments";

type MessageThreadRoute = RouteProp<CartStackParamList, "MessageThread">;
type MessageThreadNav = NativeStackNavigationProp<CartStackParamList, "MessageThread">;

const SCROLL_AT_BOTTOM_THRESHOLD_PX = 48;
const SCROLL_TO_BOTTOM_SHOW_THRESHOLD_PX = 500;
const LOAD_OLDER_SCROLL_THRESHOLD_PX = 120;

export default function MessageThreadPage() {
  const { t } = useTranslation();
  const navigation = useNavigation<MessageThreadNav>();
  const { params } = useRoute<MessageThreadRoute>();
  const isSupport = params.isSupport === true;
  const insets = useSafeAreaInsets();
  const stableBottomInsetRef = useRef(insets.bottom);
  if (insets.bottom > stableBottomInsetRef.current) {
    stableBottomInsetRef.current = insets.bottom;
  }
  const stableBottomInset = stableBottomInsetRef.current;
  const listRef = useRef<FlashListRef<MessageThreadListRow>>(null);
  const composerInputRef = useRef<TextInput>(null);
  const isAtBottomRef = useRef(true);
  const scrollAfterSendRef = useRef(false);
  const pendingOpenScrollRef = useRef(true);
  const scrollFabVisible = useSharedValue(0);
  const [showScrollFab, setShowScrollFab] = useState(false);
  const { colors, mode } = useAppTheme();
  const [draft, setDraft] = useState(params.initialDraft ?? "");
  const [attachments, setAttachments] = useState<MessageAttachmentDraft[]>([]);
  const [attachmentViewer, setAttachmentViewer] = useState<MessageAttachmentDraft | null>(null);
  const [isStickerPanelOpen, setStickerPanelOpen] = useState(false);
  const [footerHeight, setFooterHeight] = useState(COMPOSER_HEIGHT + FOOTER_VERTICAL_PADDING * 2 + 1);
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ id: string; originalContent: string } | null>(null);
  const { user } = useAuth();
  const { threadId, isResolvingThread, resolveError } = useResolvedMessageThreadId({
    threadId: params.threadId,
    peerId: params.peerId,
    isSupport,
  });
  const {
    messages,
    peer,
    peerLastReadAt,
    peerLastSeenAt,
    isLoading,
    hasMoreOlder,
    loadOlderMessages,
    isLoadingOlder,
  } = useThreadMessages(threadId);
  const peerIsOnline = useIsUserOnline(isSupport ? null : peer?.id);
  const threadReady = !!threadId && !isResolvingThread;
  const { schedule: scheduleMarkRead } = useDebouncedMarkThreadRead(threadId, threadReady && !isLoading);
  const { peerIsTyping, stopTyping } = useMessageThreadTyping({
    threadId,
    userId: user?.id,
    peerId: isSupport ? null : (peer?.id ?? params.peerId ?? null),
    draft,
    enabled: !isSupport && threadReady,
  });
  const sendMessage = useSendMessage();
  const reactToMessage = useReactToMessage();
  const deleteMessage = useDeleteMessage();
  const editMessage = useEditMessage();

  useEffect(() => {
    markMessagingPerfStart("thread_open");
    pendingOpenScrollRef.current = true;
    setEditingMessage(null);
  }, [threadId]);

  useEffect(() => {
    if (!isLoading && messages.length >= 0 && threadReady) {
      markMessagingPerfEnd("thread_open", `${messages.length} messages`);
    }
  }, [isLoading, messages.length, threadReady]);

  useEffect(() => {
    if (!resolveError) return;
    Toast.show({
      type: "error",
      text1: t("messages.toastCouldNotOpenChat"),
      text2: resolveError instanceof Error ? resolveError.message : t("messages.toastTryAgain"),
    });
  }, [resolveError, t]);

  const leaveThread = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.reset({ index: 0, routes: [{ name: "CartMain" }] });
  }, [navigation]);

  const androidSwipeBackPanHandlers = useAndroidFullSwipeBackPanHandlers(navigation, {
    swipeBackFallback: leaveThread,
  });

  const openSharedPlace = useCallback(
    (placeId: string) => {
      navigateFeedPlaceDetail(navigation, placeId);
    },
    [navigation],
  );
  const openSharedStory = useCallback(
    (storyId: string) => {
      navigateFeedFocusStory(navigation, storyId, user?.id ?? null);
    },
    [navigation, user?.id],
  );

  const peerPresence = useMemo(
    () =>
      resolvePeerPresenceStatus({
        peerIsTyping,
        peerIsOnline,
        peerLastSeenAt,
        typingLabel: t("messages.thread.peerTyping"),
        onlineLabel: t("messages.thread.peerOnline"),
      }),
    [peerIsTyping, peerIsOnline, peerLastSeenAt, t],
  );

  const scheduleMarkReadRef = useRef(scheduleMarkRead);
  scheduleMarkReadRef.current = scheduleMarkRead;

  useFocusEffect(
    useCallback(() => {
      pendingOpenScrollRef.current = true;
      scheduleMarkReadRef.current();
      return undefined;
    }, []),
  );

  useEffect(() => {
    if (!messages.length) return;
    scheduleMarkReadRef.current();
  }, [messages.length]);

  const peerName = isSupport
    ? (params.threadTitle ?? t("messages.support"))
    : peerFullName(peer?.first_name ?? params.peerFirstName ?? null, peer?.last_name ?? params.peerLastName ?? null);
  const peerAvatar = isSupport ? null : (peer?.avatar_url ?? params.peerAvatarUrl ?? null);
  const rows = useMessageThreadListRows(messages);

  const handleListScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
      isAtBottomRef.current = distanceFromBottom <= SCROLL_AT_BOTTOM_THRESHOLD_PX;
      const shouldShowFab = distanceFromBottom > SCROLL_TO_BOTTOM_SHOW_THRESHOLD_PX;
      // Android: do not assign withTiming() from JS scroll handler — corrupts SharedValue (String/Double crash).
      scrollFabVisible.value = shouldShowFab ? 1 : 0;
      setShowScrollFab((prev) => (prev === shouldShowFab ? prev : shouldShowFab));

      if (contentOffset.y < LOAD_OLDER_SCROLL_THRESHOLD_PX && hasMoreOlder && !isLoadingOlder) {
        void loadOlderMessages();
      }
    },
    [hasMoreOlder, isLoadingOlder, loadOlderMessages, scrollFabVisible],
  );

  const scrollToBottom = useCallback((animated = true) => {
    listRef.current?.scrollToEnd({ animated });
    isAtBottomRef.current = true;
    scrollFabVisible.value = 0;
    setShowScrollFab(false);
  }, [scrollFabVisible]);

  const flushScrollToBottomOnOpen = useCallback(() => {
    if (!pendingOpenScrollRef.current) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!pendingOpenScrollRef.current) return;
        scrollToBottom(false);
        pendingOpenScrollRef.current = false;
      });
    });
  }, [scrollToBottom]);

  const flushScrollAfterSend = useCallback(() => {
    if (!scrollAfterSendRef.current) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!scrollAfterSendRef.current) return;
        scrollAfterSendRef.current = false;
        scrollToBottom(true);
      });
    });
  }, [scrollToBottom]);

  const scrollFabAnimatedStyle = useAnimatedStyle(() => {
    const visibility = scrollFabVisible.value;
    return {
      opacity: withTiming(visibility, { duration: 200, easing: Easing.out(Easing.cubic) }),
      transform: [
        {
          scale: withTiming(0.88 + visibility * 0.12, { duration: 200, easing: Easing.out(Easing.cubic) }),
        },
      ],
    };
  });

  useEffect(() => {
    if (isLoading) return;
    if (rows.length === 0) {
      pendingOpenScrollRef.current = false;
      return;
    }
    flushScrollToBottomOnOpen();
  }, [isLoading, rows.length, threadId, flushScrollToBottomOnOpen]);

  useEffect(() => {
    if (!scrollAfterSendRef.current || rows.length === 0) return;
    flushScrollAfterSend();
  }, [rows, flushScrollAfterSend]);

  const handleListContentSizeChange = useCallback(() => {
    if (pendingOpenScrollRef.current) {
      flushScrollToBottomOnOpen();
    }
    if (!scrollAfterSendRef.current) return;
    flushScrollAfterSend();
  }, [flushScrollAfterSend, flushScrollToBottomOnOpen]);

  const openDeleteOptions = useCallback(
    (messageId: string, isMine: boolean) => {
      if (!isMine) return;
      Alert.alert("Delete message", "Choose delete mode", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete for me",
          onPress: () => {
            void deleteMessage
              .mutateAsync({ threadId, messageId, mode: "me" })
              .then(() => {
                Toast.show({ type: "success", text1: "Deleted for you" });
              })
              .catch((error) => {
                Toast.show({
                  type: "error",
                  text1: "Delete failed",
                  text2: error instanceof Error ? error.message : "Please try again.",
                });
              });
          },
        },
        {
          text: "Delete for everyone",
          style: "destructive",
          onPress: () => {
            void deleteMessage
              .mutateAsync({ threadId, messageId, mode: "everyone" })
              .then(() => {
                Toast.show({ type: "success", text1: "Deleted for everyone" });
              })
              .catch((error) => {
                Toast.show({
                  type: "error",
                  text1: "Delete failed",
                  text2: error instanceof Error ? error.message : "Please try again.",
                });
              });
          },
        },
      ]);
    },
    [deleteMessage, threadId],
  );

  const styles = useMessageThreadStyles(insets.top, stableBottomInset);
  const tabBarHeight = useBottomTabBarHeight();
  const androidKeyboardTrim =
    Platform.OS === "android" ? MESSAGE_THREAD_ANDROID_KEYBOARD_TRIM_PX : 0;
  const keyboardInsetOptions = useMemo(
    () => ({
      gap: MESSAGE_THREAD_KEYBOARD_GAP,
      tabBarHeight: Platform.OS === "ios" ? tabBarHeight : 0,
      bottomInset: 0,
      ignoreWindowResize: Platform.OS === "android",
    }),
    [tabBarHeight],
  );
  const keyboardInset = useKeyboardInset(keyboardInsetOptions);

  const refocusComposerInput = useCallback(() => {
    composerInputRef.current?.focus();
  }, []);

  const cancelEditingMessage = useCallback(() => {
    setEditingMessage(null);
    setDraft("");
  }, []);

  const startEditingMessage = useCallback(
    (messageId: string, content: string) => {
      setEditingMessage({ id: messageId, originalContent: content });
      setDraft(content.trim());
      setAttachments([]);
      setStickerPanelOpen(false);
      setReactionPickerMessageId(null);
      refocusComposerInput();
    },
    [refocusComposerInput],
  );

  const saveEditedMessage = useCallback(() => {
    if (!threadReady || !editingMessage) return;
    const trimmed = draft.trim();
    if (!trimmed) {
      Alert.alert("Message required", "Message text cannot be empty.");
      return;
    }
    if (trimmed === editingMessage.originalContent.trim()) {
      cancelEditingMessage();
      return;
    }
    stopTyping();
    void editMessage
      .mutateAsync({
        threadId,
        messageId: editingMessage.id,
        content: trimmed,
      })
      .then(() => {
        cancelEditingMessage();
      })
      .catch((error) => {
        Toast.show({
          type: "error",
          text1: "Edit failed",
          text2: error instanceof Error ? error.message : "Please try again.",
        });
      });
  }, [cancelEditingMessage, draft, editMessage, editingMessage, stopTyping, threadId, threadReady]);

  const handleFooterLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    setFooterHeight((prev) => (prev === nextHeight ? prev : nextHeight));
  }, []);

  const listKeyboardSpacerStyle = useAnimatedStyle(() => ({
    height:
      Platform.OS === "android"
        ? Math.max(0, keyboardInset.value - androidKeyboardTrim)
        : 0,
  }));

  const footerHeightShared = useSharedValue(footerHeight);
  useEffect(() => {
    footerHeightShared.value = footerHeight;
  }, [footerHeight, footerHeightShared]);

  const scrollFabPositionStyle = useAnimatedStyle(() => ({
    bottom:
      12 +
      footerHeightShared.value +
      (Platform.OS === "android" ? keyboardInset.value : 0),
  }));

  const mergeDrafts = useCallback((prev: MessageAttachmentDraft[], next: MessageAttachmentDraft[]) => {
    const seen = new Set(prev.map((p) => p.uri));
    const merged = [...prev];
    for (const d of next) {
      if (seen.has(d.uri)) continue;
      seen.add(d.uri);
      merged.push(d);
      if (merged.length >= 8) break;
    }
    return merged;
  }, []);

  const pickMedia = async () => {
    Keyboard.dismiss();
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Allow photo access to add attachments.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsEditing: false,
      allowsMultipleSelection: true,
      quality: 0.9,
      selectionLimit: 8,
    });
    if (result.canceled) return;
    const next: MessageAttachmentDraft[] = result.assets
      .filter((a) => Boolean(a.uri))
      .map((a) => ({
        uri: a.uri,
        mimeType: a.mimeType ?? null,
        name: a.fileName ?? null,
      }));
    if (!next.length) return;
    setAttachments((prev) => mergeDrafts(prev, next));
  };

  const pickDocument = async () => {
    Keyboard.dismiss();
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: true,
    });
    if (result.canceled || !result.assets?.length) return;
    const next: MessageAttachmentDraft[] = result.assets.map((a) => ({
      uri: a.uri,
      mimeType: a.mimeType ?? null,
      name: a.name ?? null,
    }));
    setAttachments((prev) => mergeDrafts(prev, next));
  };

  const appendStickerToDraft = useCallback((emoji: string) => {
    setDraft((prev) => `${prev}${emoji}`);
    refocusComposerInput();
  }, [refocusComposerInput]);

  const toggleStickerPanel = useCallback(() => {
    setStickerPanelOpen((prev) => !prev);
  }, []);

  const handleStickerPress = useCallback(() => {
    toggleStickerPanel();
    refocusComposerInput();
  }, [refocusComposerInput, toggleStickerPanel]);

  const handleAttachPress = useCallback(() => {
    void (async () => {
      await pickMedia();
      refocusComposerInput();
    })();
  }, [pickMedia, refocusComposerInput]);

  const handleAttachLongPress = useCallback(() => {
    void (async () => {
      await pickDocument();
      refocusComposerInput();
    })();
  }, [pickDocument, refocusComposerInput]);

  const openAttachmentViewer = useCallback((uri: string, draftAttachment?: MessageAttachmentDraft | null) => {
    if (draftAttachment?.uri === uri) {
      setAttachmentViewer(draftAttachment);
      return;
    }
    setAttachmentViewer({ uri, mimeType: null, name: null });
  }, []);

  const onToggleReactionPicker = useCallback((messageId: string) => {
    setReactionPickerMessageId((prev) => (prev === messageId ? null : messageId));
  }, []);

  const onOpenReactionPicker = useCallback((messageId: string) => {
    setReactionPickerMessageId(messageId);
  }, []);

  const onCloseReactionPicker = useCallback(() => setReactionPickerMessageId(null), []);

  const onReact = useCallback(
    (messageId: string, reaction: string, active: boolean) => {
      void reactToMessage.mutateAsync({
        threadId,
        messageId,
        reaction,
        active,
      });
    },
    [reactToMessage, threadId],
  );

  const awaitingInitialMessages = isResolvingThread || (threadReady && isLoading && rows.length === 0);
  const keyExtractor = useCallback((row: MessageThreadListRow) => row.key, []);
  const getItemType = useCallback((row: MessageThreadListRow) => row.kind, []);

  const listKeyboardSpacer = useCallback(
    () => <Animated.View style={listKeyboardSpacerStyle} />,
    [listKeyboardSpacerStyle],
  );

  const renderRow = useCallback(
    ({ item }: { item: MessageThreadListRow }) => (
      <MessageThreadRow
        item={item}
        styles={styles}
        colors={colors}
        mode={mode}
        peerLastReadAt={peerLastReadAt}
        reactionPickerMessageId={reactionPickerMessageId}
        onToggleReactionPicker={onToggleReactionPicker}
        onOpenReactionPicker={onOpenReactionPicker}
        onOpenDelete={openDeleteOptions}
        onOpenEdit={startEditingMessage}
        onReact={onReact}
        onCloseReactionPicker={onCloseReactionPicker}
        onOpenSharedPlace={openSharedPlace}
        onOpenSharedStory={openSharedStory}
        onOpenAttachment={(uri) => openAttachmentViewer(uri, null)}
      />
    ),
    [
      colors,
      mode,
      onCloseReactionPicker,
      onReact,
      onToggleReactionPicker,
      onOpenReactionPicker,
      openAttachmentViewer,
      openDeleteOptions,
      openSharedPlace,
      openSharedStory,
      peerLastReadAt,
      reactionPickerMessageId,
      startEditingMessage,
      styles,
    ],
  );

  return (
    <View style={styles.root} {...androidSwipeBackPanHandlers}>
      <ThreadHeader
        styles={styles}
        colors={colors}
        peerName={peerName}
        presenceLabel={peerPresence.label}
        presenceIsOnline={peerPresence.isOnline}
        isSupport={isSupport}
        peerAvatar={peerAvatar}
        onBack={leaveThread}
      />

      <View style={[styles.content, styles.contentBelowHeader]}>
        {awaitingInitialMessages ? (
          <MessageThreadSkeleton styles={styles} />
        ) : (
          <View style={styles.listWrap}>
            {isLoadingOlder ? (
              <View style={{ paddingVertical: 8, alignItems: "center" }}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null}
            <FlashList
              ref={listRef}
              key={threadId}
              style={styles.list}
              data={rows}
              keyExtractor={keyExtractor}
              getItemType={getItemType}
              estimatedItemSize={FLASH_LIST_ESTIMATED_SIZE.messageBubble}
              contentContainerStyle={[
                styles.listContent,
                { paddingBottom: footerHeight + 12 },
                rows.length === 0 && styles.listContentEmpty,
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
              onScroll={handleListScroll}
              onContentSizeChange={handleListContentSizeChange}
              scrollEventThrottle={32}
              renderItem={renderRow}
              removeClippedSubviews
              initialNumToRender={12}
              maxToRenderPerBatch={10}
              windowSize={7}
              updateCellsBatchingPeriod={50}
              ListFooterComponent={listKeyboardSpacer}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyText}>No messages yet.</Text>
                </View>
              }
            />
            <Animated.View
              style={[styles.scrollToBottomBtn, scrollFabPositionStyle, scrollFabAnimatedStyle]}
              pointerEvents={showScrollFab ? "auto" : "none"}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Scroll to latest messages"
                style={styles.scrollToBottomPressable}
                onPress={() => scrollToBottom()}
              >
                <Ionicons name="chevron-down" size={22} color={colors.text} />
              </Pressable>
            </Animated.View>
          </View>
        )}
      </View>

      <KeyboardStickyView {...keyboardInsetOptions} inset={keyboardInset} insetTrim={androidKeyboardTrim}>
        <View onLayout={handleFooterLayout}>
          <View style={styles.footer}>
            {peerIsTyping ? (
              <View style={styles.typingRow} accessibilityLiveRegion="polite">
                <Text style={styles.typingText}>{t("messages.thread.peerTyping")}</Text>
              </View>
            ) : null}
            {editingMessage ? (
              <View style={styles.editingBar}>
                <Text style={styles.editingBarText}>Editing message</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cancel editing"
                  hitSlop={8}
                  onPress={cancelEditingMessage}
                >
                  <Ionicons name="close" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            ) : null}
            {isStickerPanelOpen && !editingMessage ? (
              <View style={styles.stickerPanel}>
                {COMMENT_STICKERS.map((sticker) => (
                  <Pressable
                    key={sticker.id}
                    style={styles.stickerChip}
                    accessibilityLabel={sticker.emoji}
                    onPress={() => appendStickerToDraft(sticker.emoji)}
                  >
                    <SmartImage uri={sticker.imageUrl} style={styles.stickerImage} contentFit="contain" />
                  </Pressable>
                ))}
              </View>
            ) : null}
            {attachments.length && !editingMessage ? (
              <View style={styles.attachmentStrip}>
                {attachments.map((a) => {
                  const k = detectAttachmentKind(a.uri, a.mimeType);
                  return (
                    <View key={a.uri} style={styles.attachmentThumbWrap}>
                      <Pressable onPress={() => openAttachmentViewer(a.uri, a)}>
                        {k === "image" ? (
                          <SmartImage uri={a.uri} style={styles.attachmentThumb} contentFit="cover" />
                        ) : (
                          <View style={[styles.attachmentThumb, styles.attachmentThumbPlaceholder]}>
                            <Ionicons
                              name={k === "video" ? "videocam-outline" : "document-text-outline"}
                              size={22}
                              color={colors.textMuted}
                            />
                          </View>
                        )}
                      </Pressable>
                      <Pressable
                        style={styles.attachmentRemove}
                        onPress={() => setAttachments((prev) => prev.filter((item) => item.uri !== a.uri))}
                      >
                        <Ionicons name="close" size={12} color={colors.textMuted} />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ) : null}
            <View style={styles.composerRow}>
              {!editingMessage ? (
                <Pressable
                  accessibilityHint="Long press to attach a file"
                  style={styles.attachBtn}
                  onPress={handleAttachPress}
                  onLongPress={handleAttachLongPress}
                >
                  <View style={styles.composerIconTouchTarget}>
                    <Ionicons name="attach-outline" size={18} color={colors.textMuted} />
                  </View>
                </Pressable>
              ) : null}
              <View style={editingMessage ? styles.composerInputShell : styles.inputWrap}>
                <RichTextarea
                  ref={composerInputRef}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={editingMessage ? "Edit message..." : "Write a message..."}
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, editingMessage ? styles.inputEditing : null]}
                  editable={!editMessage.isPending}
                />
                {editingMessage ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Save edited message"
                    style={[
                      styles.composerSaveBtn,
                      (!draft.trim() || editMessage.isPending) && styles.composerSaveBtnDisabled,
                    ]}
                    disabled={!draft.trim() || editMessage.isPending}
                    onPress={saveEditedMessage}
                  >
                    {editMessage.isPending ? (
                      <ActivityIndicator size="small" color={colors.onPrimary} />
                    ) : (
                      <Ionicons name="checkmark" size={18} color={colors.onPrimary} />
                    )}
                  </Pressable>
                ) : null}
              </View>
              {!editingMessage ? (
                <>
                  <Pressable style={styles.stickerBtn} onPress={handleStickerPress}>
                    <View style={styles.composerIconTouchTarget}>
                      <Ionicons name="happy-outline" size={18} color={colors.textMuted} />
                    </View>
                  </Pressable>
                  <Pressable
                    style={[styles.sendBtn, { opacity: draft.trim().length || attachments.length ? 1 : 0.5 }]}
                    disabled={
                      !threadReady || (!draft.trim().length && !attachments.length) || sendMessage.isPending
                    }
                    onPress={() => {
                      if (!threadReady) return;
                      stopTyping();
                      Keyboard.dismiss();
                      if (!isAtBottomRef.current) {
                        scrollAfterSendRef.current = true;
                      }
                      void sendMessage
                        .mutateAsync({
                          threadId,
                          content: draft,
                          attachments: attachments.map((x) => ({
                            uri: x.uri,
                            mimeType: x.mimeType,
                            name: x.name,
                          })),
                        })
                        .then(() => {
                          setDraft("");
                          setAttachments([]);
                          setStickerPanelOpen(false);
                        })
                        .catch(() => {
                          scrollAfterSendRef.current = false;
                        });
                    }}
                  >
                    {sendMessage.isPending ? (
                      <ActivityIndicator size="small" color={colors.onPrimary} />
                    ) : (
                      <Ionicons name="paper-plane-outline" size={17} color={colors.onPrimary} />
                    )}
                  </Pressable>
                </>
              ) : null}
            </View>
          </View>
        </View>
      </KeyboardStickyView>

      <AttachmentViewerModal
        visible={attachmentViewer != null}
        uri={attachmentViewer?.uri ?? null}
        mimeHint={attachmentViewer?.mimeType}
        displayName={attachmentViewer?.name}
        colors={colors}
        onClose={() => setAttachmentViewer(null)}
      />
    </View>
  );
}
