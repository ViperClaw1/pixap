import { useMemo } from "react";
import { Platform, StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";
import type { ThemeMode } from "@/app/providers/ThemeProvider";
import {
  COMPOSER_ICON_HIT_SLOP,
  COMPOSER_HEIGHT,
  COMPOSER_ROW_GAP,
  COMPOSER_TRAILING_GAP,
  FOOTER_VERTICAL_PADDING,
  messageThreadHeaderHeight,
} from "@/shared/lib/messageThreadLayout";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";

export const messageThreadStaticStyles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  contentBelowHeader: {},
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    borderBottomWidth: 1,
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
  peerName: { fontSize: 16, fontWeight: "700" },
  peerSeen: { fontSize: 12, marginTop: 2 },
  peerTyping: { fontStyle: "italic" },
  typingRow: {
    paddingHorizontal: 2,
    paddingBottom: 4,
  },
  typingText: {
    fontSize: 12,
    fontStyle: "italic",
  },
  peerAvatar: { width: 36, height: 36, borderRadius: 18 },
  supportPeerAvatar: {
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: "center",
  },
  list: { flex: 1 },
  invertedList: { transform: [{ scaleY: -1 as const }] },
  invertedListItem: { transform: [{ scaleY: -1 as const }] },
  listHiddenWhilePositioning: { opacity: 0 },
  listWrap: { flex: 1 },
  /** Android-only sticky footer dock (MessageThreadPage). */
  androidFooterDock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9,
  },
  scrollToBottomBtn: {
    position: "absolute",
    right: 12,
    bottom: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    zIndex: 8,
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.12,
          shadowRadius: 6,
        }
      : { elevation: 4 }),
  },
  scrollToBottomPressable: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  listLoading: {
    flex: 1,
    justifyContent: "flex-start",
  },
  emptyWrap: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  emptyText: { textAlign: "center", fontSize: 15 },
  dividerWrap: { alignItems: "center", marginVertical: 6 },
  dividerText: {
    fontSize: 12,
    fontWeight: "600",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  bubbleWrapMine: { alignItems: "flex-end" },
  bubbleWrapPeer: { alignItems: "flex-start" },
  bubbleGroupedWithPrevious: { marginTop: 4 },
  bubble: {
    maxWidth: "80%",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingRight: 12,
    borderWidth: 0,
  },
  bubbleMine: {
    borderTopRightRadius: 6,
  },
  bubblePeer: {
    borderTopLeftRadius: 6,
  },
  bubbleTextMine: { fontSize: 15, lineHeight: 20 },
  bubbleTextPeer: { fontSize: 15, lineHeight: 20 },
  storyShareButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  storyShareButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  storyShareButtonMine: {},
  storyShareButtonTextMine: {},
  storyShareButtonSpinnerMine: {},
  storyShareButtonPeer: {},
  storyShareButtonTextPeer: {},
  storyShareButtonSpinnerPeer: {},
  bubbleAttachments: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  bubbleAttachmentsMine: { justifyContent: "flex-end" },
  bubbleMediaShellMine: { maxWidth: "80%", alignSelf: "flex-end" },
  bubbleMediaShellPeer: { maxWidth: "80%", alignSelf: "flex-start" },
  bubbleRichMessageCard: {
    borderRadius: 14,
    overflow: "hidden",
    alignItems: "stretch",
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  bubbleAttachmentsBleed: { alignSelf: "stretch", gap: 4 },
  bubblePaddedFooter: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    paddingRight: 12,
  },
  bubbleAttachmentBleedSingleMine: {
    alignSelf: "stretch",
    minWidth: 160,
    height: 200,
    borderWidth: 0,
    borderRadius: 0,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 6,
  },
  bubbleAttachmentBleedSinglePeer: {
    alignSelf: "stretch",
    minWidth: 160,
    height: 200,
    borderWidth: 0,
    borderRadius: 0,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 14,
  },
  bareMediaAttachments: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    maxWidth: "82%",
  },
  bareMediaAttachmentsMine: { alignSelf: "flex-end", justifyContent: "flex-end" },
  bareMediaAttachmentsPeer: { alignSelf: "flex-start", justifyContent: "flex-start" },
  bubbleAttachmentImage: {
    width: 160,
    height: 160,
    borderRadius: 10,
    borderWidth: 1,
  },
  bubbleAttachmentSticker: {
    width: 80,
    height: 80,
    borderWidth: 0,
    backgroundColor: "transparent",
  },
  bubbleAttachmentPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  bubbleMetaRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  bubbleMetaRowMine: { alignSelf: "flex-end" },
  bubbleMetaRowPeer: { alignSelf: "flex-start" },
  bubbleMetaRowBareMine: { alignSelf: "flex-end", marginTop: 4 },
  bubbleMetaRowBarePeer: { alignSelf: "flex-start", marginTop: 4 },
  bubbleMeta: { fontSize: 11 },
  bubbleMetaMine: {},
  bubbleMetaPeer: {},
  bubbleMetaBare: {},
  readIndicator: { marginTop: 0.5 },
  reactionRow: { marginTop: 5, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  reactionChip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
  reactionChipActive: {},
  reactionText: { fontSize: 12, fontWeight: "600" },
  reactionTrigger: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteTrigger: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
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
  },
  pickerRow: { marginTop: 6, flexDirection: "row", gap: 6 },
  pickerBtn: {
    minWidth: 32,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: FOOTER_VERTICAL_PADDING,
    alignItems: "stretch",
    gap: 8,
  },
  stickerPanel: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  stickerChip: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  stickerImage: { width: 32, height: 32 },
  attachmentStrip: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  attachmentThumbWrap: { position: "relative" },
  attachmentThumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    borderWidth: 1,
  },
  attachmentThumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
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
    borderWidth: 1,
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: COMPOSER_ROW_GAP,
  },
  composerIconBtn: {
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  },
  composerTrailingGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: COMPOSER_TRAILING_GAP,
  },
  inputWrap: { flex: 1, minWidth: 0 },
  composerInputShell: {
    position: "relative",
    flex: 1,
    minWidth: 0,
  },
  editingBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  editingBarText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    marginRight: 8,
  },
  composerSaveBtn: {
    position: "absolute",
    right: 6,
    bottom: 6,
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  composerSaveBtnDisabled: {
    opacity: 0.45,
  },
  input: {
    minHeight: COMPOSER_HEIGHT,
    maxHeight: 120,
    borderWidth: 0,
    backgroundColor: "transparent",
    fontSize: 14,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  inputEditing: {
    paddingRight: 44,
  },
  sendBtn: {
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    marginLeft: 5,
  },
});

export function messageThreadThemeStyles(
  colors: ThemeColors,
  mode: ThemeMode,
  insetsTop: number,
  stableBottomInset: number,
) {
  return {
    root: { backgroundColor: colors.background },
    header: {
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
      paddingTop: Math.max(insetsTop, 10),
    },
    peerName: { color: colors.text },
    peerSeen: { color: colors.textMuted },
    peerTyping: { color: colors.primary },
    typingText: { color: colors.textMuted },
    peerAvatar: { backgroundColor: colors.surface },
    listContent: {
      paddingTop: 12,
    },
    contentBelowHeader: {
      marginTop: messageThreadHeaderHeight(insetsTop),
    },
    emptyText: { color: colors.textMuted },
    dividerText: {
      color: colors.textMuted,
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
    bubbleMine: {
      backgroundColor: colors.accent,
    },
    bubblePeer: {
      backgroundColor: colors.messageBubblePeer,
    },
    bubbleTextMine: { color: colors.onPrimary },
    bubbleTextPeer: { color: colors.text },
    storyShareButtonMine: { backgroundColor: "rgba(255,255,255,0.96)" },
    storyShareButtonTextMine: { color: colors.accent },
    /** White pill on accent bubble — dark spinner in both themes for contrast. */
    storyShareButtonSpinnerMine: { color: mode === "dark" ? colors.onPrimary : colors.text },
    storyShareButtonPeer: { backgroundColor: colors.primary },
    storyShareButtonTextPeer: { color: colors.onPrimary },
    storyShareButtonSpinnerPeer: { color: colors.onPrimary },
    bubbleAttachmentBleedSingleMine: { backgroundColor: colors.surface },
    bubbleAttachmentBleedSinglePeer: { backgroundColor: colors.surface },
    bubbleAttachmentImage: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    bubbleAttachmentSticker: {
      backgroundColor: "transparent",
    },
    bubbleAttachmentPlaceholder: { borderColor: colors.border },
    bubbleMetaMine: {
      color: colors.messageMetaOnAccent,
    },
    bubbleMetaPeer: {
      color: colors.messageMetaOnPeer,
    },
    bubbleMetaBare: { color: colors.textMuted },
    reactionChip: {
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    reactionChipActive: { borderColor: colors.primary },
    reactionText: { color: colors.text },
    reactionTrigger: {
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    deleteTrigger: {
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    swipeActionBtn: {
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    pickerBtn: {
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    footer: {
      borderTopColor: colors.border,
      backgroundColor: colors.card,
    },
    androidFooterDock: {
      backgroundColor: colors.card,
    },
    stickerPanel: {
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    stickerChip: {},
    attachmentThumb: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    attachmentRemove: {
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
    sendBtn: {},
    input: {
      backgroundColor: "transparent",
      color: colors.text,
    },
    editingBarText: { color: colors.textMuted },
    composerSaveBtn: { backgroundColor: colors.primary },
    scrollToBottomBtn: {
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
  } satisfies Partial<Record<keyof typeof messageThreadStaticStyles, object>>;
}

export type MessageThreadStyles = typeof messageThreadStaticStyles;

export function useMessageThreadStyles(insetsTop: number, stableBottomInset: number) {
  const themed = useThemeStyles(
    ({ colors, mode }) => messageThreadThemeStyles(colors, mode, insetsTop, stableBottomInset),
    [insetsTop, stableBottomInset],
  );
  return useMemo(() => mergeStaticAndThemed(messageThreadStaticStyles, themed), [themed]);
}

/** @deprecated Use useMessageThreadStyles */
export function createMessageThreadStyles(
  colors: ThemeColors,
  mode: ThemeMode,
  insetsTop: number,
  stableBottomInset: number,
) {
  return mergeStaticAndThemed(
    messageThreadStaticStyles,
    messageThreadThemeStyles(colors, mode, insetsTop, stableBottomInset),
  );
}
