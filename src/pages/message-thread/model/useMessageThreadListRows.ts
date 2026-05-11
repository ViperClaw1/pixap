import { useMemo } from "react";
import type { MessageBubble } from "@/entities/messages";
import { messageDateGroupLabel } from "./format";
import type { MessageThreadListRow } from "./types";

export function useMessageThreadListRows(messages: MessageBubble[]): MessageThreadListRow[] {
  return useMemo(() => {
    const data: MessageThreadListRow[] = [];
    let prevLabel = "";
    for (const message of messages) {
      const label = messageDateGroupLabel(message.created_at);
      if (label !== prevLabel) {
        data.push({ kind: "divider", key: `divider-${message.id}`, label });
        prevLabel = label;
      }
      data.push({ kind: "message", key: `message-${message.id}`, message });
    }
    return data;
  }, [messages]);
}
