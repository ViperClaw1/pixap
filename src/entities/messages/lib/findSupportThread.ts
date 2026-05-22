import type { MessageThreadItem } from "@/shared/model/types/messages";

/** The current user's own «Contact support» thread (`support_user_id = viewer`). */
export function findSupportThread(
  threads: MessageThreadItem[],
  userId: string | null | undefined,
): MessageThreadItem | null {
  if (!userId) return null;
  return threads.find((thread) => thread.is_support && thread.support_user_id === userId) ?? null;
}
