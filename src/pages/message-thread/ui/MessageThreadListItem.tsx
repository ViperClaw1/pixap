import { memo } from "react";
import { Pressable, Text, View, type StyleProp, type TextStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import type { MessageBubble } from "@/entities/messages";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import type { ThemeColors } from "@/shared/theme/palettes";
import type { ThemeMode } from "@/contexts/ThemeContext";
import { REACTION_SET } from "../model/constants";
import type { MessageThreadStyles } from "./messageThreadStyles";
import { splitShareEntityContent } from "@/shared/lib/placeShareMessage";

type Props = {
  item: MessageBubble;
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
};

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
    return <Text style={baseStyle}>{content}</Text>;
  }
  const segments = splitShareEntityContent(content);
  const hasLink = segments.some((s) => s.kind !== "text");
  if (!hasLink) {
    return <Text style={baseStyle}>{content}</Text>;
  }
  return (
    <Text style={baseStyle}>
      {segments.map((seg, i) =>
        seg.kind === "text" ? (
          <Text key={`t-${i}`}>{seg.text}</Text>
        ) : seg.kind === "story" ? (
          <Text
            key={`s-${i}-${seg.id}`}
            style={{ color: linkColor, fontWeight: "700" }}
            onPress={() => onOpenStory?.(seg.id)}
          >
            {seg.label}
          </Text>
        ) : (
          <Text
            key={`p-${i}-${seg.id}`}
            style={{ color: linkColor, fontWeight: "700" }}
            onPress={() => onOpenPlace(seg.id)}
          >
            {seg.label}
          </Text>
        ),
      )}
    </Text>
  );
}

function MessageThreadListItemComponent({
  item: message,
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
}: Props) {
  const isMine = message.mine;
  const isReadByPeer =
    isMine && !!peerLastSeenAt && new Date(message.created_at).getTime() <= new Date(peerLastSeenAt).getTime();

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
                  <Pressable
                    style={s.swipeActionBtn}
                    onPress={() => onToggleReactionPicker(message.id)}
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
      <View style={isMine ? s.bubbleWrapMine : s.bubbleWrapPeer}>
        <View style={[s.bubble, isMine ? s.bubbleMine : s.bubblePeer]}>
          {message.content && message.content !== "[attachment]" ? (
            <MessageBodyText
              content={message.content}
              baseStyle={isMine ? s.bubbleTextMine : s.bubbleTextPeer}
              linkColor={colors.primary}
              onOpenPlace={onOpenSharedPlace}
              onOpenStory={onOpenSharedStory}
            />
          ) : null}
          {message.attachments.length ? (
            <View style={s.bubbleAttachments}>
              {message.attachments.map((uri) => (
                <SmartImage key={`${message.id}-${uri}`} uri={uri} style={s.bubbleAttachmentImage} contentFit="cover" />
              ))}
            </View>
          ) : null}
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
