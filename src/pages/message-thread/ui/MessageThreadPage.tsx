import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Alert,
  Dimensions,
  FlatList,
  Keyboard,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/contexts/ThemeContext";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { RichTextarea } from "@/shared/ui/rich-textarea/RichTextarea";
import { useDeleteMessage, useReactToMessage, useSendMessage, useThreadMessages } from "@/entities/messages";
import type { CartStackParamList } from "@/navigation/types";
import Toast from "react-native-toast-message";

type MessageThreadRoute = RouteProp<CartStackParamList, "MessageThread">;
type MessageThreadNav = NativeStackNavigationProp<CartStackParamList, "MessageThread">;

const REACTION_SET = ["👍", "❤️", "🔥"] as const;
const COMPOSER_HEIGHT = 50
const KEYBOARD_GAP = 0;
const FOOTER_VERTICAL_PADDING = 16
const STICKER_URLS = [
  "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f44d.png",
  "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f525.png",
  "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2764.png",
  "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f389.png",
  "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f60e.png",
  "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f680.png",
] as const;

function fullName(first?: string | null, last?: string | null) {
  return `${first?.trim() ?? ""} ${last?.trim() ?? ""}`.trim() || "Unknown user";
}

function formatRelativeTime(value?: string | null) {
  if (!value) return "last seen recently";
  const createdAtMs = new Date(value).getTime();
  if (Number.isNaN(createdAtMs)) return "last seen recently";
  const diffSeconds = Math.max(0, Math.floor((Date.now() - createdAtMs) / 1000));
  if (diffSeconds < 60) return `last seen ${diffSeconds} seconds ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `last seen ${diffMinutes} minutes ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `last seen ${diffHours} hours ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `last seen ${diffDays} days ago`;
}

function dateGroupLabel(value: string) {
  const date = new Date(value);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (target === startOfToday) return "Today";
  if (target === startOfYesterday) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "long", day: "2-digit" });
}

type RenderItem =
  | { kind: "divider"; key: string; label: string }
  | { kind: "message"; key: string; message: ReturnType<typeof useThreadMessages>["messages"][number] };

export default function MessageThreadPage() {
  const navigation = useNavigation<MessageThreadNav>();
  const { params } = useRoute<MessageThreadRoute>();
  const insets = useSafeAreaInsets();
  const stableBottomInsetRef = useRef(insets.bottom);
  if (insets.bottom > stableBottomInsetRef.current) {
    stableBottomInsetRef.current = insets.bottom;
  }
  const stableBottomInset = stableBottomInsetRef.current;
  const { colors, mode } = useAppTheme();
  const tabBarHeight = useBottomTabBarHeight();
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isStickerPanelOpen, setStickerPanelOpen] = useState(false);
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<string | null>(null);
  const keyboardInsetAnim = useRef(new Animated.Value(0)).current;
  const { messages, peer, peerLastSeenAt, isLoading } = useThreadMessages(params.threadId);
  const sendMessage = useSendMessage();
  const reactToMessage = useReactToMessage();
  const deleteMessage = useDeleteMessage();
  const edgeSwipeResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_evt, gestureState) => {
        const screenWidth = Dimensions.get("window").width;
        const fromLeftEdge = gestureState.x0 < 28 && gestureState.dx > 10;
        const fromRightEdge = gestureState.x0 > screenWidth - 28 && gestureState.dx < -10;
        return (fromLeftEdge || fromRightEdge) && Math.abs(gestureState.dy) < 12;
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const isSwipeFromLeft = gestureState.dx > 72;
        const isSwipeFromRight = gestureState.dx < -72;
        if ((isSwipeFromLeft || isSwipeFromRight) && Math.abs(gestureState.dy) < 24) {
          navigation.goBack();
        }
      },
    }),
  ).current;

  const peerName = fullName(peer?.first_name ?? params.peerFirstName ?? null, peer?.last_name ?? params.peerLastName ?? null);
  const peerAvatar = peer?.avatar_url ?? params.peerAvatarUrl ?? null;

  const rows = useMemo(() => {
    const data: RenderItem[] = [];
    let prevLabel = "";
    for (const message of messages) {
      const label = dateGroupLabel(message.created_at);
      if (label !== prevLabel) {
        data.push({ kind: "divider", key: `divider-${message.id}`, label });
        prevLabel = label;
      }
      data.push({ kind: "message", key: `message-${message.id}`, message });
    }
    return data;
  }, [messages]);

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

  const stylesThemed = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background },
        content: { flex: 1 },
        header: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.card,
          paddingTop: Math.max(insets.top, 10),
          paddingHorizontal: 12,
          paddingBottom: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        },
        backBtn: {
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: "center",
          justifyContent: "center",
        },
        headerCenter: { flex: 1, alignItems: "center" },
        peerName: { color: colors.text, fontSize: 16, fontWeight: "700" },
        peerSeen: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
        peerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface },
        listContent: {
          paddingTop: Math.max(insets.top, 10) + 62,
          paddingHorizontal: 12,
          paddingBottom: Math.max(stableBottomInset, 12) + 12,
          gap: 8,
        },
        list: { flex: 1 },
        emptyListContent: {
          flexGrow: 1,
          justifyContent: "center",
        },
        emptyWrap: {
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 20,
          gap: 10,
        },
        emptyText: { color: colors.textMuted, textAlign: "center", fontSize: 15 },
        dividerWrap: { alignItems: "center", marginVertical: 6 },
        dividerText: {
          color: colors.textMuted,
          fontSize: 12,
          fontWeight: "600",
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 999,
          paddingHorizontal: 10,
          paddingVertical: 4,
        },
        bubbleWrapMine: { alignItems: "flex-end" },
        bubbleWrapPeer: { alignItems: "flex-start" },
        bubble: {
          width: "80%",
          borderRadius: 14,
          paddingHorizontal: 12,
          paddingVertical: 8,
          paddingRight: 12,
          borderWidth: 0,
        },
        bubbleMine: {
          backgroundColor: mode === "dark" ? "#ff7a59" : "#ec6544",
          borderTopRightRadius: 6,
        },
        bubblePeer: {
          backgroundColor: mode === "dark" ? "#1f2230" : "#f3f6ff",
          borderTopLeftRadius: 6,
        },
        bubbleTextMine: { color: colors.onPrimary, fontSize: 15, lineHeight: 20 },
        bubbleTextPeer: { color: colors.text, fontSize: 15, lineHeight: 20 },
        bubbleAttachments: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 6 },
        bubbleAttachmentImage: {
          width: 160,
          height: 160,
          borderRadius: 10,
          backgroundColor: colors.surface,
        },
        bubbleMetaRow: {
          marginTop: 4,
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
        },
        bubbleMetaRowMine: { alignSelf: "flex-end" },
        bubbleMetaRowPeer: { alignSelf: "flex-start" },
        bubbleMeta: { fontSize: 11 },
        bubbleMetaMine: { color: mode === "dark" ? "rgba(17,24,39,0.78)" : "rgba(255,255,255,0.72)" },
        bubbleMetaPeer: { color: mode === "dark" ? "rgba(255,255,255,0.52)" : "rgba(17,24,39,0.48)" },
        readIndicator: { marginTop: 0.5 },
        reactionRow: { marginTop: 5, flexDirection: "row", flexWrap: "wrap", gap: 6 },
        reactionChip: {
          borderRadius: 999,
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
        },
        reactionChipActive: { borderColor: colors.primary },
        reactionText: { color: colors.text, fontSize: 12, fontWeight: "600" },
        reactionTrigger: {
          width: 28,
          height: 28,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.card,
        },
        deleteTrigger: {
          width: 28,
          height: 28,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.card,
        },
        swipeActionWrap: {
          justifyContent: "center",
          paddingHorizontal: 8,
        },
        swipeActionRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        },
        swipeActionBtn: {
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
        },
        pickerRow: { marginTop: 6, flexDirection: "row", gap: 6 },
        pickerBtn: {
          minWidth: 32,
          height: 30,
          borderRadius: 15,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          alignItems: "center",
          justifyContent: "center",
        },
        footer: {
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.card,
          paddingHorizontal: 12,
          paddingVertical: FOOTER_VERTICAL_PADDING,
          alignItems: "stretch",
          gap: 12
        },
        stickerPanel: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 14,
          backgroundColor: colors.background,
          padding: 8,
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
        },
        stickerChip: {
          width: 46,
          height: 46,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.card,
        },
        stickerImage: { width: 28, height: 28, borderRadius: 8 },
        attachmentStrip: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
        attachmentThumbWrap: { position: "relative" },
        attachmentThumb: {
          width: 64,
          height: 64,
          borderRadius: 10,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        },
        attachmentRemove: {
          position: "absolute",
          top: -6,
          right: -6,
          width: 20,
          height: 20,
          borderRadius: 10,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
        },
        composerRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        },
        attachBtn: {
          width: COMPOSER_HEIGHT,
          height: COMPOSER_HEIGHT,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
        },
        stickerBtn: {
          width: COMPOSER_HEIGHT,
          height: COMPOSER_HEIGHT,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
        },
        inputWrap: { flex: 1, minWidth: 0 },
        input: {
          minHeight: COMPOSER_HEIGHT,
          maxHeight: 120,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 14,
          backgroundColor: colors.background,
          color: colors.text,
          fontSize: 15,
          paddingHorizontal: 12,
          paddingVertical: 10,
        },
        sendBtn: {
          width: COMPOSER_HEIGHT,
          height: COMPOSER_HEIGHT,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primary,
        },
      }),
    [colors, insets.top, mode, stableBottomInset],
  );

  useEffect(() => {
    const animateKeyboardInset = (toValue: number, duration?: number) => {
      Animated.timing(keyboardInsetAnim, {
        toValue,
        duration: duration ?? 250,
        useNativeDriver: false,
      }).start();
    };
    const onKeyboardFrameChange = (event: { endCoordinates: { height: number; screenY?: number }; duration?: number }) => {
      const windowHeight = Dimensions.get("window").height;
      const keyboardTop = event.endCoordinates.screenY ?? windowHeight - event.endCoordinates.height;
      const overlap = Math.max(0, windowHeight - keyboardTop);
      const nextInset = Math.max(0, overlap - tabBarHeight + KEYBOARD_GAP);
      animateKeyboardInset(nextInset, event.duration);
    };
    const onKeyboardHide = (event?: { duration?: number }) => {
      animateKeyboardInset(0, event?.duration);
    };
    const showEvent = Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, onKeyboardFrameChange);
    const hideSub = Keyboard.addListener(hideEvent, onKeyboardHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardInsetAnim, stableBottomInset, tabBarHeight]);

  const pickImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Allow photo access to add attachments.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      allowsMultipleSelection: true,
      quality: 0.9,
      selectionLimit: 5,
    });
    if (result.canceled) return;
    const uris = result.assets.map((asset) => asset.uri).filter(Boolean);
    if (!uris.length) return;
    setAttachments((prev) => Array.from(new Set([...prev, ...uris])).slice(0, 8));
  };

  const toggleStickerPanel = async () => {
    setStickerPanelOpen((prev) => !prev);
  };

  return (
    <View style={stylesThemed.root} {...edgeSwipeResponder.panHandlers}>
      <Animated.View style={[stylesThemed.content, { paddingBottom: keyboardInsetAnim }]}>
        <View style={stylesThemed.header}>
          <Pressable style={stylesThemed.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Pressable>
          <View style={stylesThemed.headerCenter}>
            <Text style={stylesThemed.peerName} numberOfLines={1}>
              {peerName}
            </Text>
            <Text style={stylesThemed.peerSeen}>{formatRelativeTime(peerLastSeenAt)}</Text>
          </View>
          <SmartImage uri={peerAvatar} style={stylesThemed.peerAvatar} contentFit="cover" />
        </View>

        <FlatList
          style={stylesThemed.list}
          data={rows}
          keyExtractor={(item) => item.key}
          contentContainerStyle={[stylesThemed.listContent, !rows.length ? stylesThemed.emptyListContent : null]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          renderItem={({ item }) => {
            if (item.kind === "divider") {
              return (
                <View style={stylesThemed.dividerWrap}>
                  <Text style={stylesThemed.dividerText}>{item.label}</Text>
                </View>
              );
            }
            const message = item.message;
            const isMine = message.mine;
            const isReadByPeer =
              isMine &&
              !!peerLastSeenAt &&
              new Date(message.created_at).getTime() <= new Date(peerLastSeenAt).getTime();
            return (
              <Swipeable
                overshootLeft={false}
                overshootRight={false}
                renderLeftActions={
                  isMine
                    ? undefined
                    : () => (
                        <View style={stylesThemed.swipeActionWrap}>
                          <View style={stylesThemed.swipeActionRow}>
                            <Pressable
                              style={stylesThemed.swipeActionBtn}
                              onPress={() => setReactionPickerMessageId((prev) => (prev === message.id ? null : message.id))}
                            >
                              <Ionicons name="happy-outline" size={16} color={colors.textMuted} />
                            </Pressable>
                          </View>
                        </View>
                      )
                }
                renderRightActions={
                  isMine
                    ? () => (
                        <View style={stylesThemed.swipeActionWrap}>
                          <View style={stylesThemed.swipeActionRow}>
                            <Pressable
                              style={stylesThemed.swipeActionBtn}
                              onPress={() => setReactionPickerMessageId((prev) => (prev === message.id ? null : message.id))}
                            >
                              <Ionicons name="happy-outline" size={16} color={colors.textMuted} />
                            </Pressable>
                            <Pressable
                              style={stylesThemed.swipeActionBtn}
                              onPress={() => openDeleteOptions(message.id, isMine)}
                            >
                              <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                            </Pressable>
                          </View>
                        </View>
                      )
                    : undefined
                }
              >
                <View style={isMine ? stylesThemed.bubbleWrapMine : stylesThemed.bubbleWrapPeer}>
                  <View style={[stylesThemed.bubble, isMine ? stylesThemed.bubbleMine : stylesThemed.bubblePeer]}>
                    {message.content && message.content !== "[attachment]" ? (
                      <Text style={isMine ? stylesThemed.bubbleTextMine : stylesThemed.bubbleTextPeer}>{message.content}</Text>
                    ) : null}
                    {message.attachments.length ? (
                      <View style={stylesThemed.bubbleAttachments}>
                        {message.attachments.map((uri) => (
                          <SmartImage key={`${message.id}-${uri}`} uri={uri} style={stylesThemed.bubbleAttachmentImage} contentFit="cover" />
                        ))}
                      </View>
                    ) : null}
                    <View
                      style={[
                        stylesThemed.bubbleMetaRow,
                        isMine ? stylesThemed.bubbleMetaRowMine : stylesThemed.bubbleMetaRowPeer,
                      ]}
                    >
                      <Text style={[stylesThemed.bubbleMeta, isMine ? stylesThemed.bubbleMetaMine : stylesThemed.bubbleMetaPeer]}>
                        {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                      {isMine ? (
                        <Ionicons
                          style={stylesThemed.readIndicator}
                          name="checkmark-done"
                          size={14}
                          color={isReadByPeer ? (mode === "dark" ? "#111827" : "#53bdeb") : (mode === "dark" ? "#374151" : "rgba(255,255,255,0.62)")}
                        />
                      ) : null}
                    </View>
                  </View>
                  {message.reactions.length ? (
                    <View style={stylesThemed.reactionRow}>
                      {message.reactions.map((reaction) => (
                        <Pressable
                          key={`${message.id}-${reaction.reaction}`}
                          style={[stylesThemed.reactionChip, reaction.mine ? stylesThemed.reactionChipActive : null]}
                          onPress={() =>
                            void reactToMessage.mutateAsync({
                              threadId: params.threadId,
                              messageId: message.id,
                              reaction: reaction.reaction,
                              active: reaction.mine,
                            })
                          }
                        >
                          <Text style={stylesThemed.reactionText}>
                            {reaction.reaction} {reaction.count}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                  {reactionPickerMessageId === message.id ? (
                    <View style={stylesThemed.pickerRow}>
                      {REACTION_SET.map((reaction) => (
                        <Pressable
                          key={`${message.id}-picker-${reaction}`}
                          style={stylesThemed.pickerBtn}
                          onPress={() => {
                            const active = message.reactions.some((x) => x.reaction === reaction && x.mine);
                            void reactToMessage.mutateAsync({
                              threadId: params.threadId,
                              messageId: message.id,
                              reaction,
                              active,
                            });
                            setReactionPickerMessageId(null);
                          }}
                        >
                          <Text>{reaction}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              </Swipeable>
            );
          }}
          ListEmptyComponent={
            <View style={stylesThemed.emptyWrap}>
              {isLoading ? <ActivityIndicator color={colors.primary} /> : <Text style={stylesThemed.emptyText}>No messages yet.</Text>}
            </View>
          }
        />

        <View style={stylesThemed.footer}>
          {isStickerPanelOpen ? (
            <View style={stylesThemed.stickerPanel}>
              {STICKER_URLS.map((stickerUri) => (
                <Pressable key={stickerUri} style={stylesThemed.stickerChip} onPress={() => setAttachments((prev) => [...prev, stickerUri])}>
                  <SmartImage uri={stickerUri} style={stylesThemed.stickerImage} contentFit="contain" />
                </Pressable>
              ))}
            </View>
          ) : null}
          {attachments.length ? (
            <View style={stylesThemed.attachmentStrip}>
              {attachments.map((uri) => (
                <View key={uri} style={stylesThemed.attachmentThumbWrap}>
                  <SmartImage uri={uri} style={stylesThemed.attachmentThumb} contentFit="cover" />
                  <Pressable style={stylesThemed.attachmentRemove} onPress={() => setAttachments((prev) => prev.filter((item) => item !== uri))}>
                    <Ionicons name="close" size={12} color={colors.textMuted} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
          <View style={stylesThemed.composerRow}>
            <Pressable style={stylesThemed.attachBtn} onPress={() => void pickImages()}>
              <Ionicons name="attach-outline" size={18} color={colors.textMuted} />
            </Pressable>
            <View style={stylesThemed.inputWrap}>
              <RichTextarea
                value={draft}
                onChangeText={setDraft}
                placeholder="Write a message..."
                placeholderTextColor={colors.textMuted}
                style={stylesThemed.input}
              />
            </View>
            <Pressable style={stylesThemed.stickerBtn} onPress={() => void toggleStickerPanel()}>
              <Ionicons name="happy-outline" size={18} color={colors.textMuted} />
            </Pressable>
            <Pressable
              style={[stylesThemed.sendBtn, { opacity: draft.trim().length || attachments.length ? 1 : 0.5 }]}
              disabled={(!draft.trim().length && !attachments.length) || sendMessage.isPending}
              onPress={() => {
                void sendMessage.mutateAsync({ threadId: params.threadId, content: draft, attachments }).then(() => {
                  setDraft("");
                  setAttachments([]);
                  setStickerPanelOpen(false);
                });
              }}
            >
              <Ionicons name={sendMessage.isPending ? "sync-outline" : "paper-plane-outline"} size={17} color={colors.onPrimary} />
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
