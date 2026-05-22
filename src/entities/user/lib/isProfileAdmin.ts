/** `profiles.account_role === 'admin'` — full booking / boost access, no credit consumption. */
export function isProfileAdmin(accountRole: string | null | undefined): boolean {
  return accountRole === "admin";
}
