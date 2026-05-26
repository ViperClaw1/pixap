import { memo } from "react";
import { Text, View } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";
import type { ThemeMode } from "@/app/providers/ThemeProvider";
import type { MessageThreadStyles } from "@/shared/theme/messageThreadStyles";
import type { MessageThreadListRow } from "../model/types";
import { MessageThreadListItem } from "./MessageThreadListItem";

type Props = {
  item: MessageThreadListRow;
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
  onOpenSharedPlace: (placeId: string) => void;
  onOpenSharedStory: (storyId: string) => void;
  onOpenAttachment: (uri: string) => void;
};

function MessageThreadRowComponent({
  item,
  styles,
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
  onOpenAttachment,
}: Props) {
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
      peerLastReadAt={peerLastReadAt}
      reactionPickerMessageId={reactionPickerMessageId}
      onToggleReactionPicker={onToggleReactionPicker}
      onOpenReactionPicker={onOpenReactionPicker}
      onOpenDelete={onOpenDelete}
      onOpenEdit={onOpenEdit}
      onReact={onReact}
      onCloseReactionPicker={onCloseReactionPicker}
      onOpenSharedPlace={onOpenSharedPlace}
      onOpenSharedStory={onOpenSharedStory}
      onOpenAttachment={onOpenAttachment}
      enableLinkPreview={item.isLatestPage}
    />
  );
}

export const MessageThreadRow = memo(MessageThreadRowComponent, (prev, next) => {
  if (prev.item.kind !== next.item.kind) return false;
  if (prev.item.kind === "divider" && next.item.kind === "divider") {
    return prev.item.key === next.item.key && prev.item.label === next.item.label;
  }
  if (prev.item.kind === "message" && next.item.kind === "message") {
    const pickerOpenPrev = prev.reactionPickerMessageId === prev.item.message.id;
    const pickerOpenNext = next.reactionPickerMessageId === next.item.message.id;
    if (pickerOpenPrev !== pickerOpenNext) return false;
    const prevMsg = prev.item.message;
    const nextMsg = next.item.message;
    return (
      prev.item.key === next.item.key &&
      prevMsg.id === nextMsg.id &&
      prevMsg.content === nextMsg.content &&
      prevMsg.created_at === nextMsg.created_at &&
      prevMsg.attachments.length === nextMsg.attachments.length &&
      prevMsg.reactions.length === nextMsg.reactions.length &&
      prev.item.groupedWithPrevious === next.item.groupedWithPrevious &&
      prev.item.isLatestPage === next.item.isLatestPage &&
      prev.peerLastReadAt === next.peerLastReadAt &&
      prev.mode === next.mode
    );
  }
  return false;
});
