export const ACCOUNT_DELETION_CONFIRM_PREFIX = "DELETE-";

export function buildAccountDeletionConfirmPhrase(username: string): string {
  const normalized = username.trim().toLowerCase();
  return `${ACCOUNT_DELETION_CONFIRM_PREFIX}${normalized}`;
}

export function isAccountDeletionConfirmed(input: string, username: string): boolean {
  const expected = buildAccountDeletionConfirmPhrase(username);
  return input.trim() === expected;
}
