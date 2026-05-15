import { memo, useMemo } from "react";
import { Linking, Pressable, Text, View, type StyleProp, type TextStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import type { MessageBubble } from "@/entities/messages";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import type { ThemeColors } from "@/shared/theme/palettes";
import type { ThemeMode } from "@/app/providers/ThemeProvider";
import { REACTION_SET, isStickerAssetUri } from "../model/constants";
import type { MessageThreadStyles } from "@/shared/theme/messageThreadStyles";
import { splitShareEntityContent } from "@/shared/lib/placeShareMessage";
import { findFirstHttpUrl, splitTextWithUrls } from "@/shared/lib/messageUrlSegments";
import { MessageUrlPreviewBlock } from "@/features/message-link-preview";
import { detectAttachmentKind, MessageVideoThumbnail } from "@/features/message-attachments";

type Props = {
  item: MessageBubble;
  groupedWithPrevious?: boolean;
  styles: MessageThreadStyles;
  colors: ThemeColors;
  mode: ThemeMode;
  peerLastSeenAt: string | null | undefined;
  reactionPickerMessageId: string | null;
  onToggleReactionPicker: (messageId: string) => void;
  onOpenDelete: (messageId: string, isMine: boolean) => void;
  onReact: (messageId: string, reaction: string, active: boolean) => void;
  onCloseReactionPicker: () => void;
  onOpenSharedPlace?: (placeId: string) => void;
  onOpenSharedStory?: (storyId: string) => void;
  onOpenAttachment?: (uri: string) => void;
};

function messageHasVisibleText(content: string | null | undefined): boolean {
  const t = content?.trim() ?? "";
  if (!t) return false;
  return t !== "[attachment]";
}

async function openExternalUrl(url: string) {
  try {
    const can = await Linking.canOpenURL(url);
    if (can) await Linking.openURL(url);
  } catch {
    /* ignore */
  }
}

function MessageBodyText({
  content,
  baseStyle,
  linkColor,
  onOpenPlace,
  onOpenStory,
}: {
  content: string;
  baseStyle: StyleProp<TextStyle>;
  linkColor: string;
  onOpenPlace?: (placeId: string) => void;
  onOpenStory?: (storyId: string) => void;
}) {
  if (!onOpenPlace && !onOpenStory) {
    const urlParts = splitTextWithUrls(content);
    const hasUrl = urlParts.some((s) => s.kind === "url");
    if (!hasUrl) {
      return <Text style={baseStyle}>{content}</Text>;
    }
    return (
      <Text style={baseStyle}>
        {urlParts.map((seg, i) =>
          seg.kind === "text" ? (
            <Text key={`u-t-${i}`}>{seg.text}</Text>
          ) : (
            <Text
              key={`u-l-${i}`}
              style={{ color: linkColor, fontWeight: "600", textDecorationLine: "underline" }}
              onPress={() => void openExternalUrl(seg.url)}
            >
              {seg.text}
            </Text>
          ),
        )}
      </Text>
    );
  }

  const segments = splitShareEntityContent(content);
  const hasEntity = segments.some((s) => s.kind !== "text");
  if (!hasEntity) {
    const urlParts = splitTextWithUrls(content);
    const hasUrl = urlParts.some((s) => s.kind === "url");
    if (!hasUrl) {
      return <Text style={baseStyle}>{content}</Text>;
    }
    return (
      <Text style={baseStyle}>
        {urlParts.map((seg, i) =>
          seg.kind === "text" ? (
            <Text key={`e0-t-${i}`}>{seg.text}</Text>
          ) : (
            <Text
              key={`e0-u-${i}`}
              style={{ color: linkColor, fontWeight: "600", textDecorationLine: "underline" }}
              onPress={() => void openExternalUrl(seg.url)}
            >
              {seg.text}
            </Text>
          ),
        )}
      </Text>
    );
  }

  return (
    <Text style={baseStyle}>
      {segments.map((seg, i) => {
        if (seg.kind === "story") {
          return (
            <Text
              key={`s-${i}-${seg.id}`}
              style={{ color: linkColor, fontWeight: "700" }}
              onPress={() => onOpenStory?.(seg.id)}
            >
              {seg.label}
            </Text>
          );
        }
        if (seg.kind === "place") {
          return (
            <Text
              key={`p-${i}-${seg.id}`}
              style={{ color: linkColor, fontWeight: "700" }}
              onPress={() => onOpenPlace?.(seg.id)}
            >
              {seg.label}
            </Text>
          );
        }
        const urlParts = splitTextWithUrls(seg.text);
        const hasUrl = urlParts.some((s) => s.kind === "url");
        if (!hasUrl) {
          return <Text key={`t-${i}`}>{seg.text}</Text>;
        }
        return (
          <Text key={`t-${i}`}>
            {urlParts.map((u, j) =>
              u.kind === "text" ? (
                <Text key={`${i}-${j}`}>{u.text}</Text>
              ) : (
                <Text
                  key={`${i}-${j}-url`}
                  style={{ color: linkColor, fontWeight: "600", textDecorationLine: "underline" }}
                  onPress={() => void openExternalUrl(u.url)}
                >
                  {u.text}
                </Text>
              ),
            )}
          </Text>
        );
      })}
    </Text>
  );
}

function MessageThreadListItemComponent({
  item: message,
  groupedWithPrevious = false,
  styles: s,
  colors,
  mode,
  peerLastSeenAt,
  reactionPickerMessageId,
  onToggleReactionPicker,
  onOpenDelete,
  onReact,
  onCloseReactionPicker,
  onOpenSharedPlace,
  onOpenSharedStory,
  onOpenAttachment,
}: Props) {
  const isMine = message.mine;
  const isReadByPeer =
    isMine && !!peerLastSeenAt && new Date(message.created_at).getTime() <= new Date(peerLastSeenAt).getTime();

  const bareMediaOnly = message.attachments.length > 0 && !messageHasVisibleText(message.content);
  const hasMediaPlusText =
    message.attachments.length > 0 && messageHasVisibleText(message.content);
  const bubblePlainText =
    message.content && message.content !== "[attachment]" ? message.content : null;
  const hasBubbleText = bubblePlainText !== null;

  const previewUrl = useMemo(() => {
    const c = message.content?.trim() ?? "";
    if (!c || c === "[attachment]") return null;
    return findFirstHttpUrl(message.content);
  }, [message.content]);

  return (
    <Swipeable
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={
        isMine
          ? undefined
          : () => (
              <View style={s.swipeActionWrap}>
                <View style={s.swipeActionRow}>
                  <Pressable style={s.swipeActionBtn} onPress={() => onToggleReactionPicker(message.id)}>
                    <Ionicons name="happy-outline" size={16} color={colors.textMuted} />
                  </Pressable>
                </View>
              </View>
            )
      }
      renderRightActions={
        isMine
          ? () => (
              <View style={s.swipeActionWrap}>
                <View style={s.swipeActionRow}>
                  <Pressable style={s.swipeActionBtn} onPress={() => onToggleReactionPicker(message.id)}>
                    <Ionicons name="happy-outline" size={16} color={colors.textMuted} />
                  </Pressable>
                  <Pressable style={s.swipeActionBtn} onPress={() => onOpenDelete(message.id, isMine)}>
                    <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                  </Pressable>
                </View>
              </View>
            )
          : undefined
      }
    >
      <View
        style={[
          isMine ? s.bubbleWrapMine : s.bubbleWrapPeer,
          groupedWithPrevious ? s.bubbleGroupedWithPrevious : null,
        ]}
      >
        {bareMediaOnly ? (
          <>
            <View
              style={[
                s.bareMediaAttachments,
                isMine ? s.bareMediaAttachmentsMine : s.bareMediaAttachmentsPeer,
              ]}
            >
              {message.attachments.map((uri) => {
                const sticker = isStickerAssetUri(uri);
                const boxStyle = sticker ? s.bubbleAttachmentSticker : s.bubbleAttachmentImage;
                const kind = detectAttachmentKind(uri, null);
                const inner =
                  kind === "image" ? (
                    <SmartImage uri={uri} style={boxStyle} contentFit="cover" />
                  ) : kind === "video" ? (
                    <MessageVideoThumbnail videoUri={uri} style={boxStyle} iconColor={colors.textMuted} />
                  ) : (
                    <View style={[boxStyle, s.bubbleAttachmentPlaceholder]}>
                      <Ionicons name="document-text-outline" size={sticker ? 22 : 28} color={colors.textMuted} />
                    </View>
                  );
                return (
                  <Pressable
                    key={`${message.id}-${uri}`}
                    onPress={() => onOpenAttachment?.(uri)}
                    disabled={!onOpenAttachment}
                  >
                    {inner}
                  </Pressable>
                );
              })}
            </View>
            <View style={[s.bubbleMetaRow, isMine ? s.bubbleMetaRowBareMine : s.bubbleMetaRowBarePeer]}>
              <Text style={[s.bubbleMeta, s.bubbleMetaBare]}>
                {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
              {isMine ? (
                <Ionicons
                  style={s.readIndicator}
                  name="checkmark-done"
                  size={14}
                  color={
                    isReadByPeer
                      ? mode === "dark"
                        ? colors.primary
                        : "#53bdeb"
                      : colors.textMuted
                  }
                />
              ) : null}
            </View>
          </>
        ) : hasMediaPlusText ? (
          <View style={isMine ? s.bubbleMediaShellMine : s.bubbleMediaShellPeer}>
            <View style={[s.bubbleRichMessageCard, isMine ? s.bubbleMine : s.bubblePeer]}>
              <View style={[s.bubbleAttachments, s.bubbleAttachmentsBleed]}>
                {message.attachments.map((uri) => {
                  const sticker = isStickerAssetUri(uri);
                  const kind = detectAttachmentKind(uri, null);
                  const singleBleed =
                    message.attachments.length === 1 && (kind === "image" || kind === "video");
                  const boxStyle = sticker
                    ? s.bubbleAttachmentSticker
                    : singleBleed
                      ? isMine
                        ? s.bubbleAttachmentBleedSingleMine
                        : s.bubbleAttachmentBleedSinglePeer
                      : s.bubbleAttachmentImage;
                  const inner =
                    kind === "image" ? (
                      <SmartImage uri={uri} style={boxStyle} contentFit="cover" />
                    ) : kind === "video" ? (
                      <MessageVideoThumbnail videoUri={uri} style={boxStyle} iconColor={colors.textMuted} />
                    ) : (
                      <View style={[boxStyle, s.bubbleAttachmentPlaceholder]}>
                        <Ionicons name="document-text-outline" size={sticker ? 22 : 28} color={colors.textMuted} />
                      </View>
                    );
                  return (
                    <Pressable
                      key={`${message.id}-${uri}`}
                      style={singleBleed ? { alignSelf: "stretch" } : undefined}
                      onPress={() => onOpenAttachment?.(uri)}
                      disabled={!onOpenAttachment}
                    >
                      {inner}
                    </Pressable>
                  );
                })}
              </View>
              <View style={s.bubblePaddedFooter}>
                <MessageBodyText
                  content={bubblePlainText ?? ""}
                  baseStyle={isMine ? s.bubbleTextMine : s.bubbleTextPeer}
                  linkColor={colors.primary}
                  onOpenPlace={onOpenSharedPlace}
                  onOpenStory={onOpenSharedStory}
                />
                {previewUrl ? <MessageUrlPreviewBlock url={previewUrl} colors={colors} /> : null}
                <View style={[s.bubbleMetaRow, isMine ? s.bubbleMetaRowMine : s.bubbleMetaRowPeer]}>
                  <Text style={[s.bubbleMeta, isMine ? s.bubbleMetaMine : s.bubbleMetaPeer]}>
                    {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                  {isMine ? (
                    <Ionicons
                      style={s.readIndicator}
                      name="checkmark-done"
                      size={14}
                      color={
                        isReadByPeer
                          ? mode === "dark"
                            ? "#111827"
                            : "#53bdeb"
                          : mode === "dark"
                            ? "#374151"
                            : "rgba(255,255,255,0.62)"
                      }
                    />
                  ) : null}
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={[s.bubble, isMine ? s.bubbleMine : s.bubblePeer]}>
            {message.attachments.length ? (
              <View style={[s.bubbleAttachments, isMine ? s.bubbleAttachmentsMine : null]}>
                {message.attachments.map((uri) => {
                  const sticker = isStickerAssetUri(uri);
                  const kind = detectAttachmentKind(uri, null);
                  const boxStyle = sticker ? s.bubbleAttachmentSticker : s.bubbleAttachmentImage;
                  const inner =
                    kind === "image" ? (
                      <SmartImage uri={uri} style={boxStyle} contentFit="cover" />
                    ) : kind === "video" ? (
                      <MessageVideoThumbnail videoUri={uri} style={boxStyle} iconColor={colors.textMuted} />
                    ) : (
                      <View style={[boxStyle, s.bubbleAttachmentPlaceholder]}>
                        <Ionicons name="document-text-outline" size={sticker ? 22 : 28} color={colors.textMuted} />
                      </View>
                    );
                  return (
                    <Pressable
                      key={`${message.id}-${uri}`}
                      onPress={() => onOpenAttachment?.(uri)}
                      disabled={!onOpenAttachment}
                    >
                      {inner}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            {hasBubbleText ? (
              <>
                <MessageBodyText
                  content={bubblePlainText ?? ""}
                  baseStyle={isMine ? s.bubbleTextMine : s.bubbleTextPeer}
                  linkColor={colors.primary}
                  onOpenPlace={onOpenSharedPlace}
                  onOpenStory={onOpenSharedStory}
                />
                {previewUrl ? <MessageUrlPreviewBlock url={previewUrl} colors={colors} /> : null}
              </>
            ) : null}
            {!hasMediaPlusText ? (
              <View style={[s.bubbleMetaRow, isMine ? s.bubbleMetaRowMine : s.bubbleMetaRowPeer]}>
                <Text style={[s.bubbleMeta, isMine ? s.bubbleMetaMine : s.bubbleMetaPeer]}>
                  {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
                {isMine ? (
                  <Ionicons
                    style={s.readIndicator}
                    name="checkmark-done"
                    size={14}
                    color={
                      isReadByPeer
                        ? mode === "dark"
                          ? "#111827"
                          : "#53bdeb"
                        : mode === "dark"
                          ? "#374151"
                          : "rgba(255,255,255,0.62)"
                    }
                  />
                ) : null}
              </View>
            ) : null}
          </View>
        )}
        {message.reactions.length ? (
          <View style={s.reactionRow}>
            {message.reactions.map((reaction) => (
              <Pressable
                key={`${message.id}-${reaction.reaction}`}
                style={[s.reactionChip, reaction.mine ? s.reactionChipActive : null]}
                onPress={() => void onReact(message.id, reaction.reaction, reaction.mine)}
              >
                <Text style={s.reactionText}>
                  {reaction.reaction} {reaction.count}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {reactionPickerMessageId === message.id ? (
          <View style={s.pickerRow}>
            {REACTION_SET.map((reaction) => (
              <Pressable
                key={`${message.id}-picker-${reaction}`}
                style={s.pickerBtn}
                onPress={() => {
                  const active = message.reactions.some((x) => x.reaction === reaction && x.mine);
                  void onReact(message.id, reaction, active);
                  onCloseReactionPicker();
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
}

export const MessageThreadListItem = memo(MessageThreadListItemComponent);
