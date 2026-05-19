import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { RichTextarea } from "@/shared/ui/rich-textarea/RichTextarea";
import { useAuth } from "@/app/providers/AuthProvider";
import { useDeleteMessage, useReactToMessage, useSendMessage, useThreadMessages } from "@/entities/messages";
import { navigateFeedFocusStory, navigateFeedPlaceDetail } from "@/app/navigation/appNavigation";
import type { CartStackParamList } from "@/app/navigation/types";
import Toast from "react-native-toast-message";
import { useAndroidFullSwipeBackPanHandlers } from "@/shared/lib/useAndroidFullSwipeBackPanHandlers";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { UserAvatarImage } from "@/shared/ui/user-avatar-image";
import { STICKER_URLS } from "../model/constants";
import { formatRelativeLastSeen, peerFullName } from "../model/format";
import { useMessageThreadListRows } from "../model/useMessageThreadListRows";
import { useKeyboardInset } from "@/shared/lib/keyboard";
import type { MessageThreadListRow } from "../model/types";
import { useMessageThreadStyles } from "@/shared/theme/messageThreadStyles";
import { FLASH_LIST_ESTIMATED_SIZE } from "@/shared/lib/flashListEstimatedSizes";
import { MessageThreadListItem } from "./MessageThreadListItem";
import {
  AttachmentViewerModal,
  detectAttachmentKind,
  type MessageAttachmentDraft,
} from "@/features/message-attachments";

type MessageThreadRoute = RouteProp<CartStackParamList, "MessageThread">;
type MessageThreadNav = NativeStackNavigationProp<CartStackParamList, "MessageThread">;

const SCROLL_AT_BOTTOM_THRESHOLD_PX = 48;
const SCROLL_TO_BOTTOM_SHOW_THRESHOLD_PX = 500;

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
  const isAtBottomRef = useRef(true);
  const scrollAfterSendRef = useRef(false);
  const scrollFabVisible = useSharedValue(0);
  const [showScrollFab, setShowScrollFab] = useState(false);
  const { colors, mode } = useAppTheme();
  const tabBarHeight = useBottomTabBarHeight();
  const [draft, setDraft] = useState(params.initialDraft ?? "");
  const [attachments, setAttachments] = useState<MessageAttachmentDraft[]>([]);
  const [attachmentViewer, setAttachmentViewer] = useState<MessageAttachmentDraft | null>(null);
  const [isStickerPanelOpen, setStickerPanelOpen] = useState(false);
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<string | null>(null);
  const { user } = useAuth();
  const { messages, peer, peerLastSeenAt, isLoading } = useThreadMessages(params.threadId);
  const sendMessage = useSendMessage();
  const reactToMessage = useReactToMessage();
  const deleteMessage = useDeleteMessage();
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
      scrollFabVisible.value = withTiming(shouldShowFab ? 1 : 0, {
        duration: 200,
        easing: Easing.out(Easing.cubic),
      });
      setShowScrollFab((prev) => (prev === shouldShowFab ? prev : shouldShowFab));
    },
    [scrollFabVisible],
  );

  const scrollToBottom = useCallback((animated = true) => {
    listRef.current?.scrollToEnd({ animated });
    isAtBottomRef.current = true;
    scrollFabVisible.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) });
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

  const scrollFabAnimatedStyle = useAnimatedStyle(() => ({
    opacity: scrollFabVisible.value,
    transform: [{ scale: 0.88 + scrollFabVisible.value * 0.12 }],
  }));

  useEffect(() => {
    if (!scrollAfterSendRef.current || rows.length === 0) return;
    flushScrollAfterSend();
  }, [rows, flushScrollAfterSend]);

  const handleListContentSizeChange = useCallback(() => {
    if (!scrollAfterSendRef.current) return;
    flushScrollAfterSend();
  }, [flushScrollAfterSend]);

  const openDeleteOptions = (messageId: string, isMine: boolean) => {
    if (!isMine) return;
    Alert.alert("Delete message", "Choose delete mode", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete for me",
        onPress: () => {
          void deleteMessage
            .mutateAsync({ threadId: params.threadId, messageId, mode: "me" })
            .then(() => {
              Toast.show({
                type: "success",
                text1: "Deleted for you",
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
      },
      ...(isMine
        ? [
            {
              text: "Delete for everyone",
              style: "destructive" as const,
              onPress: () => {
                void deleteMessage
                  .mutateAsync({ threadId: params.threadId, messageId, mode: "everyone" })
                  .then(() => {
                    Toast.show({
                      type: "success",
                      text1: "Deleted for everyone",
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
            },
          ]
        : []),
    ]);
  };

  const styles = useMessageThreadStyles(insets.top, stableBottomInset);

  const keyboardInsetAnim = useKeyboardInset({ tabBarHeight });

  const contentAnimatedStyle = useAnimatedStyle(
    () => ({
      paddingBottom: keyboardInsetAnim.value,
    }),
    [keyboardInsetAnim],
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
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Allow photo access to add attachments.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
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

  const toggleStickerPanel = () => {
    setStickerPanelOpen((prev) => !prev);
  };

  const openAttachmentViewer = useCallback((uri: string, draft?: MessageAttachmentDraft | null) => {
    if (draft?.uri === uri) {
      setAttachmentViewer(draft);
      return;
    }
    setAttachmentViewer({ uri, mimeType: null, name: null });
  }, []);

  /** FlashList при первом mount с data=[] и center-стилем не пересчитывает layout после fetch. */
  const awaitingInitialMessages = isLoading && rows.length === 0;

  const keyExtractor = useCallback((row: MessageThreadListRow) => row.key, []);

  const renderRow = useCallback(({ item }: { item: MessageThreadListRow }) => {
    if (item.kind === "divider") {
      return (
        <View style={styles.dividerWrap}>
          <Text style={styles.dividerText}>{item.label}</Text>
        </View>
      );
    }
    return (
      <MessageThreadListItem
        item={item.message}
        groupedWithPrevious={item.groupedWithPrevious}
        styles={styles}
        colors={colors}
        mode={mode}
        peerLastSeenAt={peerLastSeenAt}
        reactionPickerMessageId={reactionPickerMessageId}
        onToggleReactionPicker={(messageId) =>
          setReactionPickerMessageId((prev) => (prev === messageId ? null : messageId))
        }
        onOpenDelete={openDeleteOptions}
        onReact={(messageId, reaction, active) =>
          void reactToMessage.mutateAsync({
            threadId: params.threadId,
            messageId,
            reaction,
            active,
          })
        }
        onCloseReactionPicker={() => setReactionPickerMessageId(null)}
        onOpenSharedPlace={openSharedPlace}
        onOpenSharedStory={openSharedStory}
        onOpenAttachment={(uri) => openAttachmentViewer(uri, null)}
      />
    );
  }, [
    colors,
    mode,
    openAttachmentViewer,
    openDeleteOptions,
    openSharedPlace,
    openSharedStory,
    params.threadId,
    peerLastSeenAt,
    reactToMessage,
    reactionPickerMessageId,
    styles,
  ]);

  return (
    <View style={styles.root} {...androidSwipeBackPanHandlers}>
      <Animated.View style={[styles.content, contentAnimatedStyle]}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={leaveThread}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.peerName} numberOfLines={1}>
              {peerName}
            </Text>
            <Text style={styles.peerSeen}>{formatRelativeLastSeen(peerLastSeenAt)}</Text>
          </View>
          {isSupport ? (
            <View style={[styles.peerAvatar, styles.supportPeerAvatar, { backgroundColor: colors.accent }]}>
              <Ionicons name="headset-outline" size={20} color={colors.onAccent} />
            </View>
          ) : (
            <UserAvatarImage uri={peerAvatar} style={styles.peerAvatar} contentFit="cover" />
          )}
        </View>

        {awaitingInitialMessages ? (
          <View style={[styles.list, styles.listContent, styles.listLoading]}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <View style={styles.listWrap}>
            <FlashList
              ref={listRef}
              key={params.threadId}
              style={styles.list}
              data={rows}
              keyExtractor={keyExtractor}
              estimatedItemSize={FLASH_LIST_ESTIMATED_SIZE.messageBubble}
              contentContainerStyle={[styles.listContent, rows.length === 0 && styles.listContentEmpty]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
              onScroll={handleListScroll}
              onContentSizeChange={handleListContentSizeChange}
              scrollEventThrottle={16}
              renderItem={renderRow}
              removeClippedSubviews
              initialNumToRender={18}
              maxToRenderPerBatch={14}
              windowSize={10}
              updateCellsBatchingPeriod={40}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyText}>No messages yet.</Text>
                </View>
              }
            />
            <Animated.View
              style={[styles.scrollToBottomBtn, scrollFabAnimatedStyle]}
              pointerEvents={showScrollFab ? "auto" : "none"}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Scroll to latest messages"
                style={styles.scrollToBottomPressable}
                onPress={scrollToBottom}
              >
                <Ionicons name="chevron-down" size={22} color={colors.text} />
              </Pressable>
            </Animated.View>
          </View>
        )}

        <View style={styles.footer}>
          {isStickerPanelOpen ? (
            <View style={styles.stickerPanel}>
              {STICKER_URLS.map((stickerUri) => (
                <Pressable
                  key={stickerUri}
                  style={styles.stickerChip}
                  onPress={() =>
                    setAttachments((prev) =>
                      mergeDrafts(prev, [{ uri: stickerUri, mimeType: "image/png", name: "sticker.png" }]),
                    )
                  }
                >
                  <SmartImage uri={stickerUri} style={styles.stickerImage} contentFit="contain" />
                </Pressable>
              ))}
            </View>
          ) : null}
          {attachments.length ? (
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
            <Pressable
              accessibilityHint="Long press to attach a file"
              style={styles.attachBtn}
              onPress={() => void pickMedia()}
              onLongPress={() => void pickDocument()}
            >
              <Ionicons name="attach-outline" size={18} color={colors.textMuted} />
            </Pressable>
            <View style={styles.inputWrap}>
              <RichTextarea
                value={draft}
                onChangeText={setDraft}
                placeholder="Write a message..."
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />
            </View>
            <Pressable style={styles.stickerBtn} onPress={toggleStickerPanel}>
              <Ionicons name="happy-outline" size={18} color={colors.textMuted} />
            </Pressable>
            <Pressable
              style={[styles.sendBtn, { opacity: draft.trim().length || attachments.length ? 1 : 0.5 }]}
              disabled={(!draft.trim().length && !attachments.length) || sendMessage.isPending}
              onPress={() => {
                if (!isAtBottomRef.current) {
                  scrollAfterSendRef.current = true;
                }
                void sendMessage
                  .mutateAsync({
                    threadId: params.threadId,
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
          </View>
        </View>
      </Animated.View>

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
