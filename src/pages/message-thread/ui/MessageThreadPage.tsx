import { AppPressable } from "@/shared/ui/app-pressable";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
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
import { navigateFeedPlaceDetail } from "@/app/navigation/appNavigation";
import { navigateToFeedStoryViewer } from "@/app/navigation/navigateToStoryViewer";
import { leaveMessageThreadToReturnTarget, resetCartStackToMain } from "@/app/navigation/navigationHelpers";
import type { BrowseFlowParamList, CartStackParamList } from "@/app/navigation/types";
import Toast from "react-native-toast-message";
import { useAndroidFullSwipeBackPanHandlers } from "@/shared/lib/useAndroidFullSwipeBackPanHandlers";
import { useAndroidHardwareBack } from "@/shared/lib/useAndroidHardwareBack";
import { useInterceptNativeStackBack } from "@/shared/lib/useInterceptNativeStackBack";
import { useDisableGestureDuringTransition } from "@/shared/lib/navigation/useDisableGestureDuringTransition";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { KeyboardStickyView, useKeyboardInset } from "@/shared/lib/keyboard";
import {
  COMPOSER_HEIGHT,
  COMPOSER_ICON_HIT_SLOP,
  COMPOSER_ICON_SIZE,
  defaultMessageFooterHeight,
  FOOTER_VERTICAL_PADDING,
  getCachedAndroidMessageFooterHeight,
  MESSAGE_THREAD_KEYBOARD_GAP,
  MESSAGE_THREAD_LIST_BOTTOM_GAP,
  setCachedAndroidMessageFooterHeight,
} from "@/shared/lib/messageThreadLayout";
import { COMMENT_STICKERS } from "@/shared/constants/commentStickers";
import { peerFullName } from "../model/format";
import { resolvePeerPresenceStatus } from "../model/peerPresenceStatus";
import { useMessageThreadListRows } from "../model/useMessageThreadListRows";
import { useMessageThreadAndroidFooterPadding } from "../model/useMessageThreadAndroidFooterPadding";
import type { MessageThreadListRow } from "../model/types";
import { useMessageThreadStyles } from "@/shared/theme/messageThreadStyles";
import { FLASH_LIST_ESTIMATED_SIZE } from "@/shared/lib/flashListEstimatedSizes";
import { markMessagingPerfEnd, markMessagingPerfStart } from "@/shared/lib/messagingPerf";
import { MessageThreadRow } from "./MessageThreadRow";
import { buildMessageReportLabels } from "../model/messageReportLabels";
import {
  getMessageThreadScrollSnapshot,
  hasMessageThreadSessionVisit,
  markMessageThreadSessionVisit,
  setMessageThreadScrollSnapshot,
  shouldOpenMessageThreadAtBottom,
} from "../model/messageThreadScrollMemory";
import { MessageThreadSkeleton } from "./MessageThreadSkeleton";
import { ThreadHeader } from "./ThreadHeader";
import {
  AttachmentViewerModal,
  detectAttachmentKind,
  type MessageAttachmentDraft,
} from "@/features/message-attachments";
import { useComposerVoiceInput, VoiceInputButton } from "@/features/speech-input";
import { AppPopupModal } from "@/shared/ui/app-popup";
import type { AppPopupButton } from "@/shared/ui/app-popup/types";

type MessageThreadRoute = RouteProp<CartStackParamList | BrowseFlowParamList, "MessageThread">;
type MessageThreadNav = NativeStackNavigationProp<
  CartStackParamList | BrowseFlowParamList,
  "MessageThread"
>;

const SCROLL_AT_BOTTOM_THRESHOLD_PX = 48;
const SCROLL_TO_BOTTOM_SHOW_THRESHOLD_PX = 500;
const LOAD_OLDER_SCROLL_THRESHOLD_PX = 120;

export default function MessageThreadPage() {
  const { t, i18n } = useTranslation();
  const reportLabels = useMemo(() => buildMessageReportLabels(t), [t, i18n.language]);
  const navigation = useNavigation<MessageThreadNav>();
  useDisableGestureDuringTransition();
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
  const voiceStopRef = useRef<(() => void) | null>(null);
  const isAtBottomRef = useRef(true);
  const scrollAfterSendRef = useRef(false);
  const canPersistScrollRef = useRef(false);
  const scrollFabVisible = useSharedValue(0);
  const [showScrollFab, setShowScrollFab] = useState(false);
  const { colors, mode } = useAppTheme();
  const [draft, setDraft] = useState(params.initialDraft ?? "");
  const { handleListeningChange, handleTranscriptChange, bindStopOnManualEdit } =
    useComposerVoiceInput(draft, setDraft);
  const [attachments, setAttachments] = useState<MessageAttachmentDraft[]>([]);
  const [attachmentViewer, setAttachmentViewer] = useState<MessageAttachmentDraft | null>(null);
  const [isStickerPanelOpen, setStickerPanelOpen] = useState(false);
  const [footerHeight, setFooterHeight] = useState(() => {
    if (Platform.OS === "android") {
      return getCachedAndroidMessageFooterHeight() ?? defaultMessageFooterHeight();
    }
    return defaultMessageFooterHeight();
  });
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ id: string; originalContent: string } | null>(null);
  const [openingStoryId, setOpeningStoryId] = useState<string | null>(null);
  const [deleteMessageTargetId, setDeleteMessageTargetId] = useState<string | null>(null);
  const openingStoryInFlightRef = useRef<string | null>(null);
  const programmaticPopRef = useRef(false);
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
    setEditingMessage(null);
    if (!threadId || !hasMessageThreadSessionVisit(threadId)) {
      canPersistScrollRef.current = false;
    } else {
      canPersistScrollRef.current = true;
    }
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
    if (threadId) {
      markMessageThreadSessionVisit(threadId);
    }
    if (params.returnTo) {
      leaveMessageThreadToReturnTarget(navigation, params.returnTo, programmaticPopRef);
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    resetCartStackToMain(navigation);
  }, [navigation, params.returnTo, threadId]);

  useInterceptNativeStackBack(navigation, Boolean(params.returnTo), leaveThread, {
    isProgrammaticPopRef: programmaticPopRef,
  });

  const androidSwipeBackPanHandlers = useAndroidFullSwipeBackPanHandlers(
    useMemo(
      () => ({
        goBack: leaveThread,
        canGoBack: () => true,
      }),
      [leaveThread],
    ),
  );

  useAndroidHardwareBack(leaveThread);

  const openSharedPlace = useCallback(
    (placeId: string) => {
      navigateFeedPlaceDetail(navigation, placeId);
    },
    [navigation],
  );
  const openSharedStory = useCallback(
    async (storyId: string) => {
      if (openingStoryInFlightRef.current) return;
      openingStoryInFlightRef.current = storyId;
      setOpeningStoryId(storyId);
      try {
        const opened = await navigateToFeedStoryViewer(navigation, storyId, user?.id ?? null);
        if (!opened) {
          Toast.show({
            type: "error",
            text1: t("messages.thread.storyUnavailable"),
          });
        }
      } finally {
        if (openingStoryInFlightRef.current === storyId) {
          openingStoryInFlightRef.current = null;
        }
        setOpeningStoryId((current) => (current === storyId ? null : current));
      }
    },
    [navigation, t, user?.id],
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
      scheduleMarkReadRef.current();
      return () => {
        if (threadId) {
          markMessageThreadSessionVisit(threadId);
        }
      };
    }, [threadId]),
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
  const isSessionRevisit = threadId ? hasMessageThreadSessionVisit(threadId) : false;
  const openAtBottom = useMemo(() => shouldOpenMessageThreadAtBottom(threadId), [threadId]);
  const isAndroid = Platform.OS === "android";
  const listContentComposerInset =
    footerHeight + MESSAGE_THREAD_LIST_BOTTOM_GAP + (isAndroid ? FOOTER_VERTICAL_PADDING : 0);

  const handleListScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const distanceFromBottom = contentOffset.y;
      const wasAtBottom = distanceFromBottom <= SCROLL_AT_BOTTOM_THRESHOLD_PX;
      isAtBottomRef.current = wasAtBottom;
      const shouldShowFab = distanceFromBottom > SCROLL_TO_BOTTOM_SHOW_THRESHOLD_PX;
      // Android: do not assign withTiming() from JS scroll handler — corrupts SharedValue (String/Double crash).
      scrollFabVisible.value = shouldShowFab ? 1 : 0;
      setShowScrollFab((prev) => (prev === shouldShowFab ? prev : shouldShowFab));

      if (threadId && canPersistScrollRef.current) {
        setMessageThreadScrollSnapshot(threadId, {
          offsetY: contentOffset.y,
          wasAtBottom,
          showScrollFab: shouldShowFab,
        });
      }

      const distanceFromTop = contentSize.height - layoutMeasurement.height - contentOffset.y;
      if (distanceFromTop < LOAD_OLDER_SCROLL_THRESHOLD_PX && hasMoreOlder && !isLoadingOlder) {
        void loadOlderMessages();
      }
    },
    [hasMoreOlder, isLoadingOlder, loadOlderMessages, scrollFabVisible, threadId],
  );

  const scrollToBottom = useCallback((animated = true) => {
    listRef.current?.scrollToOffset({ offset: 0, animated });
    isAtBottomRef.current = true;
    scrollFabVisible.value = 0;
    setShowScrollFab(false);
  }, [scrollFabVisible]);

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
    if (!scrollAfterSendRef.current || rows.length === 0) return;
    flushScrollAfterSend();
  }, [rows, flushScrollAfterSend]);

  const showLoadingSkeleton =
    !isSessionRevisit &&
    (isResolvingThread || (threadReady && isLoading && rows.length === 0));

  useEffect(() => {
    if (!showLoadingSkeleton) {
      canPersistScrollRef.current = true;
    }
  }, [showLoadingSkeleton]);

  useLayoutEffect(() => {
    if (!threadId || openAtBottom || rows.length === 0 || !isSessionRevisit) return;
    const snapshot = getMessageThreadScrollSnapshot(threadId);
    if (!snapshot || snapshot.wasAtBottom) return;
    listRef.current?.scrollToOffset({ offset: snapshot.offsetY, animated: false });
    isAtBottomRef.current = snapshot.wasAtBottom;
    scrollFabVisible.value = snapshot.showScrollFab ? 1 : 0;
    setShowScrollFab(snapshot.showScrollFab);
  }, [isSessionRevisit, openAtBottom, rows.length, scrollFabVisible, threadId]);

  const handleListContentSizeChange = useCallback(() => {
    if (!scrollAfterSendRef.current) return;
    flushScrollAfterSend();
  }, [flushScrollAfterSend]);

  const keyExtractor = useCallback((row: MessageThreadListRow) => row.key, []);
  const getItemType = useCallback((row: MessageThreadListRow) => row.kind, []);

  const dismissDeleteMessagePopup = useCallback(() => {
    setDeleteMessageTargetId(null);
  }, []);

  const runDeleteMessage = useCallback(
    (messageId: string, mode: "me" | "everyone") => {
      if (!threadId) return;
      void deleteMessage
        .mutateAsync({ threadId, messageId, mode })
        .then(() => {
          Toast.show({
            type: "success",
            text1: mode === "me" ? "Deleted for you" : "Deleted for everyone",
          });
        })
        .catch((error) => {
          Toast.show({
            type: "error",
            text1: "Delete failed",
            text2: error instanceof Error ? error.message : "Please try again.",
          });
        });
    },
    [deleteMessage, threadId],
  );

  const deleteMessagePopupButtons = useMemo((): AppPopupButton[] => {
    const messageId = deleteMessageTargetId;
    if (!messageId) return [];
    return [
      {
        text: "Delete for me",
        onPress: () => runDeleteMessage(messageId, "me"),
      },
      {
        text: "Delete for everyone",
        style: "destructive",
        onPress: () => runDeleteMessage(messageId, "everyone"),
      },
      { text: "Cancel", style: "cancel" },
    ];
  }, [deleteMessageTargetId, runDeleteMessage]);

  const openDeleteOptions = useCallback((messageId: string, isMine: boolean) => {
    if (!isMine) return;
    setDeleteMessageTargetId(messageId);
  }, []);

  const styles = useMessageThreadStyles(insets.top, stableBottomInset);
  const tabBarHeight = useBottomTabBarHeight();
  // Android `softwareKeyboardLayoutMode: pan` already lifts the window; manual inset double-shifts the footer.
  const keyboardInsetOptions = useMemo(
    () => ({
      gap: MESSAGE_THREAD_KEYBOARD_GAP,
      tabBarHeight: Platform.OS === "android" ? 0 : tabBarHeight,
      bottomInset: stableBottomInset,
      ignoreWindowResize: Platform.OS === "android",
      enabled: Platform.OS === "ios",
    }),
    [stableBottomInset, tabBarHeight],
  );
  const keyboardInset = useKeyboardInset(keyboardInsetOptions);
  const {
    footerAnimatedStyle: androidFooterAnimatedStyle,
    paddingBottom: androidFooterPaddingBottom,
    keyboardOpenRef: androidKeyboardOpenRef,
    onComposerFocus: onAndroidComposerFocus,
  } = useMessageThreadAndroidFooterPadding();

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

  const handleFooterLayout = useCallback(
    (event: LayoutChangeEvent) => {
      // Android pan + animated footer padding: ignore layout churn while the keyboard is open
      // (list already reserves FOOTER_VERTICAL_PADDING for the open-state padding).
      if (isAndroid && androidKeyboardOpenRef.current) {
        return;
      }
      const nextHeight = event.nativeEvent.layout.height;
      setFooterHeight((prev) => (prev === nextHeight ? prev : nextHeight));
      if (Platform.OS === "android") {
        setCachedAndroidMessageFooterHeight(nextHeight);
      }
    },
    [androidKeyboardOpenRef, isAndroid],
  );

  // Android `pan` lifts the whole window — no extra list spacer (would double-shift content).
  const listKeyboardSpacerStyle = useAnimatedStyle(
    () => ({
      height: isAndroid ? 0 : keyboardInset.value,
    }),
    [isAndroid, keyboardInset],
  );

  const scrollFabPositionStyle = useAnimatedStyle(
    () => ({
      bottom:
        12 +
        footerHeight +
        (isAndroid
          ? Math.max(0, androidFooterPaddingBottom.value - FOOTER_VERTICAL_PADDING)
          : keyboardInset.value),
    }),
    [androidFooterPaddingBottom, footerHeight, isAndroid, keyboardInset],
  );

  const listHeader = useCallback(
    () => <Animated.View style={listKeyboardSpacerStyle} />,
    [listKeyboardSpacerStyle],
  );

  const listFooter = useCallback(
    () =>
      isLoadingOlder ? (
        <View style={{ paddingVertical: 8, alignItems: "center" }}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : null,
    [colors.primary, isLoadingOlder],
  );

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

  const listInvertedStyle = useMemo(
    () => StyleSheet.flatten([styles.list, styles.invertedList]),
    [styles.invertedList, styles.list],
  );

  const renderRow = useCallback(
    ({ item }: { item: MessageThreadListRow }) => (
      <View style={styles.invertedListItem}>
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
          openingStoryId={openingStoryId}
          onOpenAttachment={(uri) => openAttachmentViewer(uri, null)}
          peerUserId={isSupport ? null : (peer?.id ?? params.peerId ?? null)}
          reportLabels={reportLabels}
        />
      </View>
    ),
    [
      colors,
      isSupport,
      mode,
      reportLabels,
      onCloseReactionPicker,
      onReact,
      onToggleReactionPicker,
      onOpenReactionPicker,
      openAttachmentViewer,
      openDeleteOptions,
      openSharedPlace,
      openSharedStory,
      openingStoryId,
      params.peerId,
      peer?.id,
      peerLastReadAt,
      reactionPickerMessageId,
      startEditingMessage,
      styles,
    ],
  );

  const FooterShell = isAndroid ? Animated.View : View;

  const composerFooter = (
    <View onLayout={handleFooterLayout}>
      <FooterShell style={[styles.footer, isAndroid ? androidFooterAnimatedStyle : null]}>
          {peerIsTyping ? (
            <View style={styles.typingRow} accessibilityLiveRegion="polite">
              <Text style={styles.typingText}>{t("messages.thread.peerTyping")}</Text>
            </View>
          ) : null}
          {editingMessage ? (
            <View style={styles.editingBar}>
              <Text style={styles.editingBarText}>Editing message</Text>
              <AppPressable
                accessibilityRole="button"
                accessibilityLabel="Cancel editing"
                hitSlop={8}
                onPress={cancelEditingMessage}
              >
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </AppPressable>
            </View>
          ) : null}
          {isStickerPanelOpen && !editingMessage ? (
            <View style={styles.stickerPanel}>
              {COMMENT_STICKERS.map((sticker) => (
                <AppPressable
                  key={sticker.id}
                  style={styles.stickerChip}
                  accessibilityLabel={sticker.emoji}
                  onPress={() => appendStickerToDraft(sticker.emoji)}
                >
                  <SmartImage uri={sticker.imageUrl} style={styles.stickerImage} contentFit="contain" />
                </AppPressable>
              ))}
            </View>
          ) : null}
          {attachments.length && !editingMessage ? (
            <View style={styles.attachmentStrip}>
              {attachments.map((a) => {
                const k = detectAttachmentKind(a.uri, a.mimeType);
                return (
                  <View key={a.uri} style={styles.attachmentThumbWrap}>
                    <AppPressable onPress={() => openAttachmentViewer(a.uri, a)}>
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
                    </AppPressable>
                    <AppPressable
                      style={styles.attachmentRemove}
                      onPress={() => setAttachments((prev) => prev.filter((item) => item.uri !== a.uri))}
                    >
                      <Ionicons name="close" size={12} color={colors.textMuted} />
                    </AppPressable>
                  </View>
                );
              })}
            </View>
          ) : null}
          <View style={styles.composerRow}>
            {!editingMessage ? (
              <AppPressable
                accessibilityHint="Long press to attach a file"
                style={styles.composerIconBtn}
                hitSlop={COMPOSER_ICON_HIT_SLOP}
                onPress={handleAttachPress}
                onLongPress={handleAttachLongPress}
              >
                <Ionicons name="attach" size={COMPOSER_ICON_SIZE} color={colors.textMuted} />
              </AppPressable>
            ) : null}
            {!editingMessage ? (
              <VoiceInputButton
                disabled={!threadReady || sendMessage.isPending}
                stopRef={voiceStopRef}
                style={styles.composerIconBtn}
                iconSize={COMPOSER_ICON_SIZE}
                iconName="mic"
                bare
                onTranscriptChange={handleTranscriptChange}
                onListeningChange={(listening) => {
                  if (listening) Keyboard.dismiss();
                  handleListeningChange(listening);
                }}
              />
            ) : null}
            <View style={editingMessage ? styles.composerInputShell : styles.inputWrap}>
              <TextInput
                ref={composerInputRef}
                value={draft}
                onChangeText={(value) => {
                  bindStopOnManualEdit(() => voiceStopRef.current?.());
                  setDraft(value);
                }}
                placeholder={editingMessage ? "Edit message..." : "Write a message..."}
                placeholderTextColor={colors.textMuted}
                style={[styles.input, editingMessage ? styles.inputEditing : null]}
                editable={!editMessage.isPending}
                multiline
                textAlignVertical="center"
                onFocus={() => {
                  bindStopOnManualEdit(() => voiceStopRef.current?.());
                  if (isAndroid) onAndroidComposerFocus();
                }}
              />
              {editingMessage ? (
                <AppPressable
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
                </AppPressable>
              ) : null}
            </View>
            {!editingMessage ? (
              <View style={styles.composerTrailingGroup}>
                <AppPressable
                  style={styles.composerIconBtn}
                  hitSlop={COMPOSER_ICON_HIT_SLOP}
                  onPress={handleStickerPress}
                >
                  <Ionicons name="happy" size={COMPOSER_ICON_SIZE} color={colors.textMuted} />
                </AppPressable>
                <AppPressable
                  style={styles.sendBtn}
                  hitSlop={COMPOSER_ICON_HIT_SLOP}
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
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons
                      name="send"
                      size={COMPOSER_ICON_SIZE}
                      color={draft.trim().length || attachments.length ? colors.primary : colors.textMuted}
                    />
                  )}
                </AppPressable>
              </View>
            ) : null}
          </View>
      </FooterShell>
    </View>
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
        peerUserId={isSupport ? null : (peer?.id ?? params.peerId ?? null)}
        onBack={leaveThread}
      />

      <View style={[styles.content, styles.contentBelowHeader]}>
        {showLoadingSkeleton ? (
          <MessageThreadSkeleton
            styles={styles}
            backgroundColor={colors.background}
            bottomInset={listContentComposerInset}
          />
        ) : (
          <View style={styles.listWrap}>
            <FlashList
              ref={listRef}
              key={threadId}
              style={listInvertedStyle}
              data={rows}
              keyExtractor={keyExtractor}
              getItemType={getItemType}
              estimatedItemSize={FLASH_LIST_ESTIMATED_SIZE.messageBubble}
              contentContainerStyle={[
                styles.listContent,
                { paddingTop: listContentComposerInset },
                rows.length === 0 && styles.listContentEmpty,
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
              onScroll={handleListScroll}
              onContentSizeChange={rows.length > 0 ? handleListContentSizeChange : undefined}
              scrollEventThrottle={32}
              renderItem={renderRow}
              removeClippedSubviews
              initialNumToRender={20}
              maxToRenderPerBatch={10}
              windowSize={7}
              updateCellsBatchingPeriod={50}
              ListHeaderComponent={listHeader}
              ListFooterComponent={listFooter}
              ListEmptyComponent={
                <View style={styles.invertedListItem}>
                  <View style={styles.emptyWrap}>
                    <Text style={styles.emptyText}>No messages yet.</Text>
                  </View>
                </View>
              }
            />
            <Animated.View
              style={[styles.scrollToBottomBtn, scrollFabPositionStyle, scrollFabAnimatedStyle]}
              pointerEvents={showScrollFab ? "auto" : "none"}
            >
              <AppPressable
                accessibilityRole="button"
                accessibilityLabel="Scroll to latest messages"
                style={styles.scrollToBottomPressable}
                onPress={() => scrollToBottom()}
              >
                <Ionicons name="chevron-down" size={22} color={colors.text} />
              </AppPressable>
            </Animated.View>
          </View>
        )}
      </View>

      {Platform.OS === "ios" ? (
        <KeyboardStickyView {...keyboardInsetOptions}>{composerFooter}</KeyboardStickyView>
      ) : (
        <View style={styles.androidFooterDock}>{composerFooter}</View>
      )}

      <AttachmentViewerModal
        visible={attachmentViewer != null}
        uri={attachmentViewer?.uri ?? null}
        mimeHint={attachmentViewer?.mimeType}
        displayName={attachmentViewer?.name}
        colors={colors}
        onClose={() => setAttachmentViewer(null)}
      />

      <Modal
        visible={deleteMessageTargetId !== null}
        transparent
        animationType="fade"
        onRequestClose={dismissDeleteMessagePopup}
      >
        <AppPopupModal
          embedded
          visible={deleteMessageTargetId !== null}
          title="Delete message"
          message="Choose delete mode"
          onClose={dismissDeleteMessagePopup}
          buttons={deleteMessagePopupButtons}
        />
      </Modal>
    </View>
  );
}
