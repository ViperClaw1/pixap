import type { User } from "@supabase/supabase-js";

/** True when the account was created or linked via Sign in with Apple. */
export function isAppleAuthUser(user: User | null | undefined): boolean {
  if (!user) return false;

  if (user.app_metadata?.provider === "apple") return true;

  const providers = user.app_metadata?.providers;
  if (Array.isArray(providers) && providers.includes("apple")) return true;

  return user.identities?.some((identity) => identity.provider === "apple") ?? false;
}
