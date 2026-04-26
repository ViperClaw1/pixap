import { supabase } from "@/integrations/supabase/client";

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.toLowerCase();
  return String(error ?? "").toLowerCase();
}

export function isInvalidRefreshTokenError(error: unknown): boolean {
  const message = normalizeErrorMessage(error);
  return (
    message.includes("invalid refresh token") ||
    message.includes("refresh token not found") ||
    message.includes("jwt expired")
  );
}

/**
 * Refreshes the current session, but gracefully handles revoked/stale refresh tokens
 * by clearing local auth state instead of surfacing an uncaught AuthApiError.
 */
export async function safeRefreshSession(): Promise<boolean> {
  try {
    const { error } = await supabase.auth.refreshSession();
    if (error) {
      if (isInvalidRefreshTokenError(error)) {
        await supabase.auth.signOut({ scope: "local" });
        return false;
      }
      throw error;
    }
    return true;
  } catch (error) {
    if (isInvalidRefreshTokenError(error)) {
      await supabase.auth.signOut({ scope: "local" });
      return false;
    }
    throw error;
  }
}
