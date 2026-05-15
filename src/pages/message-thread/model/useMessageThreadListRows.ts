import { useMemo } from "react";
import type { MessageBubble } from "@/entities/messages";
import { messageDateGroupLabel } from "./format";
import type { MessageThreadListRow } from "./types";

export function useMessageThreadListRows(messages: MessageBubble[]): MessageThreadListRow[] {
  return useMemo(() => {
    const data: MessageThreadListRow[] = [];
    let prevLabel = "";
    let prevMine: boolean | null = null;
    for (const message of messages) {
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
      });
      prevMine = message.mine;
    }
    return data;
  }, [messages]);
}
