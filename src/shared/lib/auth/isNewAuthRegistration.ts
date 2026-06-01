import type { User } from "@supabase/supabase-js";

/** First sign-in: Supabase sets last_sign_in_at close to created_at. */
const FIRST_SIGN_IN_WINDOW_MS = 60_000;

export function isNewAuthRegistration(user: Pick<User, "created_at" | "last_sign_in_at">): boolean {
  const createdAt = Date.parse(user.created_at);
  if (!Number.isFinite(createdAt)) return false;
  const lastSignInAt = Date.parse(user.last_sign_in_at ?? user.created_at);
  if (!Number.isFinite(lastSignInAt)) return false;
  return Math.abs(lastSignInAt - createdAt) <= FIRST_SIGN_IN_WINDOW_MS;
}
