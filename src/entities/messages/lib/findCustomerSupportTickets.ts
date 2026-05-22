import type { MessageThreadItem } from "@/shared/model/types/messages";

/** Support threads opened by end-users (`account_role = user`), not the staff member's own support chat. */
export function findCustomerSupportTickets(
  threads: MessageThreadItem[],
  staffUserId: string | null | undefined,
): MessageThreadItem[] {
  if (!staffUserId) return [];

  return threads
    .filter((thread) => {
      if (!thread.is_support || !thread.support_user_id) return false;
      if (thread.support_user_id === staffUserId) return false;
      if (thread.support_user_account_role && thread.support_user_account_role !== "user") return false;
      return true;
    })
    .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
}
