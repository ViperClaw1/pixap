import { useMemo } from "react";
import type { MessageBubble } from "@/entities/messages";
import { messageDateGroupLabel } from "./format";
import type { MessageThreadListRow } from "./types";

const LINK_PREVIEW_TAIL_COUNT = 24;

export function useMessageThreadListRows(messages: MessageBubble[]): MessageThreadListRow[] {
  return useMemo(() => {
    const data: MessageThreadListRow[] = [];
    const linkPreviewFromIndex = Math.max(0, messages.length - LINK_PREVIEW_TAIL_COUNT);
    let prevLabel = "";
    let prevMine: boolean | null = null;
    messages.forEach((message, index) => {
      const label = messageDateGroupLabel(message.created_at);
      if (label !== prevLabel) {
        data.push({ kind: "divider", key: `divider-${message.id}`, label });
        prevLabel = label;
        prevMine = null;
      }
      const groupedWithPrevious = prevMine !== null && prevMine === message.mine;
      data.push({
        kind: "message",
        key: `message-${message.id}`,
        message,
        groupedWithPrevious,
        isLatestPage: index >= linkPreviewFromIndex,
      });
      prevMine = message.mine;
    });
    const reversed = data.reverse();
    for (let i = 0; i < reversed.length; i++) {
      const row = reversed[i];
      if (row.kind !== "message") continue;
      const older = reversed[i + 1];
      const groupedWithPrevious =
        older?.kind === "message" && older.message.mine === row.message.mine;
      reversed[i] = { ...row, groupedWithPrevious };
    }
    return reversed;
  }, [messages]);
}
