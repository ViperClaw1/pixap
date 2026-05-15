import type { MessageThreadItem } from "@/shared/model/types/messages";

export function findSupportThread(threads: MessageThreadItem[]): MessageThreadItem | null {
  return threads.find((thread) => thread.is_support) ?? null;
}
