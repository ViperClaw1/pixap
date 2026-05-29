import { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector, Swipeable } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import type { MessageBubble } from "@/entities/messages";
import type { ThemeColors } from "@/shared/theme/palettes";
import type { ThemeMode } from "@/app/providers/ThemeProvider";
import { REACTION_SET, MESSAGE_DOUBLE_TAP_MAX_MS, isStickerAssetUri } from "../model/constants";
import type { MessageThreadStyles } from "@/shared/theme/messageThreadStyles";
import { splitShareEntityContent } from "@/shared/lib/placeShareMessage";
import { findFirstHttpUrl, splitTextWithUrls } from "@/shared/lib/messageUrlSegments";
import { MessageUrlPreviewBlock } from "@/features/message-link-preview";
import { detectAttachmentKind, MessageAttachmentBubble } from "@/features/message-attachments";
import { BottomSheetPickerModal } from "@/shared/ui/bottom-sheet-picker/BottomSheetPickerModal";
import { appAlert } from "@/shared/ui/app-popup";
import { useTranslation } from "react-i18next";
import { useReportContent } from "@/features/ugc-moderation";
import type { ContentReportReason } from "@/features/ugc-moderation";

function attachmentBlurhashAt(
  blurhashes: (string | null)[] | null | undefined,
  index: number,
): string | undefined {
  const hash = blurhashes?.[index];
  return typeof hash === "string" && hash.trim().length > 0 ? hash : undefined;
}

type Props = {
  item: MessageBubble;
  groupedWithPrevious?: boolean;
  styles: MessageThreadStyles;
  colors: ThemeColors;
  mode: ThemeMode;
  peerLastReadAt: string | null | undefined;
  reactionPickerMessageId: string | null;
  onToggleReactionPicker: (messageId: string) => void;
  onOpenReactionPicker: (messageId: string) => void;
  onOpenDelete: (messageId: string, isMine: boolean) => void;
  onOpenEdit?: (messageId: string, content: string) => void;
  onReact: (messageId: string, reaction: string, active: boolean) => void;
  onCloseReactionPicker: () => void;
  onOpenSharedPlace?: (placeId: string) => void;
  onOpenSharedStory?: (storyId: string) => void;
  openingStoryId?: string | null;
  onOpenAttachment?: (uri: string) => void;
  enableLinkPreview?: boolean;
  peerUserId?: string | null;
};

const REPORT_REASONS: ContentReportReason[] = [
  "spam",
  "harassment",
  "hate_speech",
  "nudity",
  "violence",
  "illegal",
  "other",
];

function messageHasVisibleText(content: string | null | undefined): boolean {
  const t = content?.trim() ?? "";
  if (!t) return false;
  return t !== "[attachment]";
}

export function canEditMessage(message: MessageBubble): boolean {
  return message.mine && messageHasVisibleText(message.content);
}

async function openExternalUrl(url: string) {
  try {
    const can = await Linking.canOpenURL(url);
    if (can) await Linking.openURL(url);
  } catch {
    /* ignore */
  }
}

function trimTextBeforeStoryLink(text: string): string {
  return text.replace(/\n+$/g, "");
}

/** Spinner on white story-share pill (readable without themed merge). */
const STORY_SHARE_SPINNER_ON_WHITE = "#111111";

function MessageBodyText({
  content,
  baseStyle,
  linkColor,
  storyButtonStyle,
  storyButtonTextStyle,
  storyButtonSpinnerColor,
  onOpenPlace,
  onOpenStory,
  openingStoryId,
}: {
  content: string;
  baseStyle: StyleProp<TextStyle>;
  linkColor: string;
  storyButtonStyle?: StyleProp<ViewStyle>;
  storyButtonTextStyle?: StyleProp<TextStyle>;
  storyButtonSpinnerColor: string;
  onOpenPlace?: (placeId: string) => void;
  onOpenStory?: (storyId: string) => void;
  openingStoryId?: string | null;
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

  const hasStoryLink = segments.some((seg) => seg.kind === "story");
  const storyLinkStyle = { color: linkColor, fontWeight: "700" as const };

  if (hasStoryLink) {
    return (
      <View>
        {segments.map((seg, i) => {
          if (seg.kind === "story") {
            const isOpening = openingStoryId === seg.id;
            return (
              <Pressable
                key={`s-${i}-${seg.id}`}
                style={storyButtonStyle}
                onPress={() => void onOpenStory?.(seg.id)}
                disabled={isOpening}
                accessibilityRole="button"
                accessibilityState={{ busy: isOpening }}
              >
                <Text style={[storyButtonTextStyle, isOpening ? { opacity: 0.55 } : null]}>{seg.label}</Text>
                {isOpening ? (
                  <ActivityIndicator size="small" color={storyButtonSpinnerColor} style={{ marginLeft: 6 }} />
                ) : null}
              </Pressable>
            );
          }
          if (seg.kind === "place") {
            return (
              <Text
                key={`p-${i}-${seg.id}`}
                style={storyLinkStyle}
                onPress={() => onOpenPlace?.(seg.id)}
              >
                {seg.label}
              </Text>
            );
          }
          const nextIsStory = segments[i + 1]?.kind === "story";
          const segmentText = nextIsStory ? trimTextBeforeStoryLink(seg.text) : seg.text;
          const urlParts = splitTextWithUrls(segmentText);
          const hasUrl = urlParts.some((s) => s.kind === "url");
          if (!hasUrl) {
            return (
              <Text key={`t-${i}`} style={baseStyle}>
                {segmentText}
              </Text>
            );
          }
          return (
            <Text key={`t-${i}`} style={baseStyle}>
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
      </View>
    );
  }

  return (
    <Text style={baseStyle}>
      {segments.map((seg, i) => {
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
        if (seg.kind === "text") {
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
        }
        return null;
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
  peerLastReadAt,
  reactionPickerMessageId,
  onToggleReactionPicker,
  onOpenReactionPicker,
  onOpenDelete,
  onOpenEdit,
  onReact,
  onCloseReactionPicker,
  onOpenSharedPlace,
  onOpenSharedStory,
  openingStoryId,
  onOpenAttachment,
  enableLinkPreview = true,
  peerUserId,
}: Props) {
  const { t } = useTranslation();
  const reportMutation = useReportContent();
  const [reportVisible, setReportVisible] = useState(false);
  const swipeableRef = useRef<Swipeable>(null);
  const closeSwipeActions = useCallback(() => {
    swipeableRef.current?.close();
  }, []);

  const handleOpenReactionPicker = useCallback(() => {
    closeSwipeActions();
    onToggleReactionPicker(message.id);
  }, [closeSwipeActions, message.id, onToggleReactionPicker]);

  const handleOpenReactionPickerFromMessage = useCallback(() => {
    closeSwipeActions();
    onOpenReactionPicker(message.id);
  }, [closeSwipeActions, message.id, onOpenReactionPicker]);

  const messageDoubleTapGesture = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .maxDuration(MESSAGE_DOUBLE_TAP_MAX_MS)
        .onEnd(() => {
          runOnJS(handleOpenReactionPickerFromMessage)();
        }),
    [handleOpenReactionPickerFromMessage],
  );

  const handlePickReaction = useCallback(
    (reaction: string) => {
      const active = message.reactions.some((x) => x.reaction === reaction && x.mine);
      closeSwipeActions();
      requestAnimationFrame(() => {
        onReact(message.id, reaction, active);
        onCloseReactionPicker();
      });
    },
    [closeSwipeActions, message.id, message.reactions, onCloseReactionPicker, onReact],
  );

  const isMine = message.mine;
  const storyShareButtonStyle = useMemo(
    () =>
      isMine
        ? [s.storyShareButton, s.storyShareButtonMine]
        : [s.storyShareButton, s.storyShareButtonPeer],
    [isMine, s.storyShareButton, s.storyShareButtonMine, s.storyShareButtonPeer],
  );
  const storyShareButtonTextStyle = useMemo(
    () =>
      isMine
        ? [s.storyShareButtonText, s.storyShareButtonTextMine]
        : [s.storyShareButtonText, s.storyShareButtonTextPeer],
    [isMine, s.storyShareButtonText, s.storyShareButtonTextMine, s.storyShareButtonTextPeer],
  );
  const storyShareSpinnerColor = useMemo(() => {
    if (isMine) {
      return (s.storyShareButtonSpinnerMine as { color?: string }).color ?? STORY_SHARE_SPINNER_ON_WHITE;
    }
    return (s.storyShareButtonSpinnerPeer as { color?: string }).color ?? colors.onPrimary;
  }, [colors.onPrimary, isMine, s.storyShareButtonSpinnerMine, s.storyShareButtonSpinnerPeer]);
  const isReadByPeer =
    isMine && !!peerLastReadAt && new Date(message.created_at).getTime() <= new Date(peerLastReadAt).getTime();

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

  const handleOpenReport = useCallback(() => {
    closeSwipeActions();
    setReportVisible(true);
  }, [closeSwipeActions]);

  const submitReport = useCallback(
    async (reason: ContentReportReason) => {
      if (!peerUserId) return;
      try {
        await reportMutation.mutateAsync({
          targetType: "message",
          targetId: message.id,
          reportedUserId: peerUserId,
          reason,
        });
        setReportVisible(false);
        void appAlert(t("moderation.reportSubmittedTitle"), t("moderation.reportSubmittedMessage"));
      } catch (error) {
        void appAlert(t("common.unknownError"), error instanceof Error ? error.message : t("common.unknownError"));
      }
    },
    [message.id, peerUserId, reportMutation, t],
  );

  return (
    <>
    <Swipeable
      ref={swipeableRef}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={
        isMine
          ? undefined
          : () => (
              <View style={s.swipeActionWrap}>
                <View style={s.swipeActionRow}>
                  <Pressable style={s.swipeActionBtn} onPress={handleOpenReactionPicker}>
                    <Ionicons name="happy-outline" size={16} color={colors.textMuted} />
                  </Pressable>
                  {peerUserId ? (
                    <Pressable style={s.swipeActionBtn} onPress={handleOpenReport}>
                      <Ionicons name="flag-outline" size={16} color={colors.textMuted} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            )
      }
      renderRightActions={
        isMine
          ? () => (
              <View style={s.swipeActionWrap}>
                <View style={s.swipeActionRow}>
                  <Pressable style={s.swipeActionBtn} onPress={handleOpenReactionPicker}>
                    <Ionicons name="happy-outline" size={16} color={colors.textMuted} />
                  </Pressable>
                  {canEditMessage(message) && onOpenEdit ? (
                    <Pressable
                      style={s.swipeActionBtn}
                      onPress={() => {
                        closeSwipeActions();
                        onOpenEdit(message.id, message.content);
                      }}
                    >
                      <Ionicons name="create-outline" size={16} color={colors.textMuted} />
                    </Pressable>
                  ) : null}
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
        <GestureDetector gesture={messageDoubleTapGesture}>
          <View>
        {bareMediaOnly ? (
          <>
            <View
              style={[
                s.bareMediaAttachments,
                isMine ? s.bareMediaAttachmentsMine : s.bareMediaAttachmentsPeer,
              ]}
            >
              {message.attachments.map((uri, attachmentIndex) => {
                const sticker = isStickerAssetUri(uri);
                const boxStyle = sticker ? s.bubbleAttachmentSticker : s.bubbleAttachmentImage;
                return (
                  <Pressable
                    key={`${message.id}-${uri}`}
                    onPress={() => onOpenAttachment?.(uri)}
                    disabled={!onOpenAttachment}
                  >
                    <MessageAttachmentBubble
                      uri={uri}
                      boxStyle={boxStyle}
                      placeholderStyle={s.bubbleAttachmentPlaceholder}
                      iconColor={colors.textMuted}
                      blurhash={attachmentBlurhashAt(message.attachment_blurhashes, attachmentIndex)}
                    />
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
                {message.attachments.map((uri, attachmentIndex) => {
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
                  return (
                    <Pressable
                      key={`${message.id}-${uri}`}
                      style={singleBleed ? { alignSelf: "stretch" } : undefined}
                      onPress={() => onOpenAttachment?.(uri)}
                      disabled={!onOpenAttachment}
                    >
                      <MessageAttachmentBubble
                        uri={uri}
                        boxStyle={boxStyle}
                        placeholderStyle={s.bubbleAttachmentPlaceholder}
                        iconColor={colors.textMuted}
                        imageLayout={singleBleed ? "bleed" : "thumb"}
                        blurhash={attachmentBlurhashAt(message.attachment_blurhashes, attachmentIndex)}
                      />
                    </Pressable>
                  );
                })}
              </View>
              <View style={s.bubblePaddedFooter}>
                <MessageBodyText
                  content={bubblePlainText ?? ""}
                  baseStyle={isMine ? s.bubbleTextMine : s.bubbleTextPeer}
                  linkColor={colors.primary}
                  storyButtonStyle={storyShareButtonStyle}
                  storyButtonTextStyle={storyShareButtonTextStyle}
                  storyButtonSpinnerColor={storyShareSpinnerColor}
                  onOpenPlace={onOpenSharedPlace}
                  onOpenStory={onOpenSharedStory}
                  openingStoryId={openingStoryId}
                />
                {enableLinkPreview && previewUrl ? <MessageUrlPreviewBlock url={previewUrl} /> : null}
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
                {message.attachments.map((uri, attachmentIndex) => {
                  const sticker = isStickerAssetUri(uri);
                  const boxStyle = sticker ? s.bubbleAttachmentSticker : s.bubbleAttachmentImage;
                  return (
                    <Pressable
                      key={`${message.id}-${uri}`}
                      onPress={() => onOpenAttachment?.(uri)}
                      disabled={!onOpenAttachment}
                    >
                      <MessageAttachmentBubble
                        uri={uri}
                        boxStyle={boxStyle}
                        placeholderStyle={s.bubbleAttachmentPlaceholder}
                        iconColor={colors.textMuted}
                        blurhash={attachmentBlurhashAt(message.attachment_blurhashes, attachmentIndex)}
                      />
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
                  storyButtonStyle={storyShareButtonStyle}
                  storyButtonTextStyle={storyShareButtonTextStyle}
                  storyButtonSpinnerColor={storyShareSpinnerColor}
                  onOpenPlace={onOpenSharedPlace}
                  onOpenStory={onOpenSharedStory}
                  openingStoryId={openingStoryId}
                />
                {enableLinkPreview && previewUrl ? <MessageUrlPreviewBlock url={previewUrl} /> : null}
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
          </View>
        </GestureDetector>
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
                onPress={() => handlePickReaction(reaction)}
              >
                <Text>{reaction}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </Swipeable>
    <BottomSheetPickerModal
      visible={reportVisible}
      onClose={() => setReportVisible(false)}
      title={t("moderation.reportTitle")}
      fitContent
    >
      <Text style={{ fontSize: 14, lineHeight: 20, marginBottom: 8, color: colors.textMuted }}>
        {t("moderation.reportHint")}
      </Text>
      {REPORT_REASONS.map((reason) => (
        <Pressable
          key={reason}
          style={{ paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}
          disabled={reportMutation.isPending}
          onPress={() => void submitReport(reason)}
        >
          <Text style={{ fontSize: 16, fontWeight: "500", color: colors.text }}>{t(`moderation.reasons.${reason}`)}</Text>
        </Pressable>
      ))}
    </BottomSheetPickerModal>
    </>
  );
}

export const MessageThreadListItem = memo(MessageThreadListItemComponent);
