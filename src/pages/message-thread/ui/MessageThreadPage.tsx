import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, FlatList, Platform, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/contexts/ThemeContext";
import { RichTextarea } from "@/shared/ui/rich-textarea/RichTextarea";
import { useDeleteMessage, useReactToMessage, useSendMessage, useThreadMessages } from "@/entities/messages";
import type { CartStackParamList, RootTabParamList } from "@/navigation/types";
import Toast from "react-native-toast-message";
import { useAndroidFullSwipeBackPanHandlers } from "@/shared/lib/useAndroidFullSwipeBackPanHandlers";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { STICKER_URLS } from "../model/constants";
import { formatRelativeLastSeen, peerFullName } from "../model/format";
import { useMessageThreadListRows } from "../model/useMessageThreadListRows";
import { useKeyboardInset } from "@/shared/lib/keyboard";
import type { MessageThreadListRow } from "../model/types";
import { createMessageThreadStyles } from "./messageThreadStyles";
import { MessageThreadListItem } from "./MessageThreadListItem";

type MessageThreadRoute = RouteProp<CartStackParamList, "MessageThread">;
type MessageThreadNav = NativeStackNavigationProp<CartStackParamList, "MessageThread">;

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
  const [draft, setDraft] = useState(params.initialDraft ?? "");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isStickerPanelOpen, setStickerPanelOpen] = useState(false);
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<string | null>(null);
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
      const rootNav = navigation as unknown as NavigationProp<RootTabParamList>;
      rootNav.navigate("Feed", { screen: "PlaceDetail", params: { id: placeId } });
    },
    [navigation],
  );
  const openSharedStory = useCallback(
    (storyId: string) => {
      const rootNav = navigation as unknown as NavigationProp<RootTabParamList>;
      rootNav.navigate("Feed", { screen: "FeedMain", params: { focusStoryId: storyId } });
    },
    [navigation],
  );

  const peerName = peerFullName(
    peer?.first_name ?? params.peerFirstName ?? null,
    peer?.last_name ?? params.peerLastName ?? null,
  );
  const peerAvatar = peer?.avatar_url ?? params.peerAvatarUrl ?? null;
  const rows = useMessageThreadListRows(messages);

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
    () => createMessageThreadStyles(colors, mode, insets.top, stableBottomInset),
    [colors, insets.top, mode, stableBottomInset],
  );

  const keyboardInsetAnim = useKeyboardInset({ tabBarHeight });

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

  const toggleStickerPanel = () => {
    setStickerPanelOpen((prev) => !prev);
  };

  const keyExtractor = useCallback((row: MessageThreadListRow) => row.key, []);

  const renderRow = useCallback(({ item }: { item: MessageThreadListRow }) => {
    if (item.kind === "divider") {
      return (
        <View style={stylesThemed.dividerWrap}>
          <Text style={stylesThemed.dividerText}>{item.label}</Text>
        </View>
      );
    }
    return (
      <MessageThreadListItem
        item={item.message}
        styles={stylesThemed}
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
      />
    );
  }, [
    colors,
    mode,
    openDeleteOptions,
    openSharedPlace,
    openSharedStory,
    params.threadId,
    peerLastSeenAt,
    reactToMessage,
    reactionPickerMessageId,
    stylesThemed,
  ]);

  return (
    <View style={stylesThemed.root} {...androidSwipeBackPanHandlers}>
      <Animated.View style={[stylesThemed.content, { paddingBottom: keyboardInsetAnim }]}>
        <View style={stylesThemed.header}>
          <Pressable style={stylesThemed.backBtn} onPress={leaveThread}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Pressable>
          <View style={stylesThemed.headerCenter}>
            <Text style={stylesThemed.peerName} numberOfLines={1}>
              {peerName}
            </Text>
            <Text style={stylesThemed.peerSeen}>{formatRelativeLastSeen(peerLastSeenAt)}</Text>
          </View>
          <SmartImage uri={peerAvatar} style={stylesThemed.peerAvatar} contentFit="cover" />
        </View>

        <FlatList
          style={stylesThemed.list}
          data={rows}
          keyExtractor={keyExtractor}
          contentContainerStyle={[stylesThemed.listContent, !rows.length ? stylesThemed.emptyListContent : null]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          renderItem={renderRow}
          removeClippedSubviews
          initialNumToRender={18}
          maxToRenderPerBatch={14}
          windowSize={10}
          updateCellsBatchingPeriod={40}
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
            <Pressable style={stylesThemed.stickerBtn} onPress={toggleStickerPanel}>
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
