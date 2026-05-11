import type { MessageBubble } from "@/entities/messages";

export type MessageThreadListRow =
  | { kind: "divider"; key: string; label: string }
  | { kind: "message"; key: string; message: MessageBubble };
