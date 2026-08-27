import { supabase } from "@/shared/api/supabase/client";
import { safeRefreshSession } from "@/shared/lib/supabaseAuth";

function isFunctionsUnauthorized(error: unknown): boolean {
  const ctx =
    error && typeof error === "object" && "context" in error
      ? (error as { context: unknown }).context
      : undefined;
  return ctx instanceof Response && ctx.status === 401;
}

export function isPixaiConciergeCreditError(error: unknown): boolean {
  const ctx =
    error && typeof error === "object" && "context" in error
      ? (error as { context: unknown }).context
      : undefined;
  return ctx instanceof Response && (ctx.status === 402 || ctx.status === 503);
}

export function isPixaiConciergeInsufficientCreditsError(error: unknown): boolean {
  const ctx =
    error && typeof error === "object" && "context" in error
      ? (error as { context: unknown }).context
      : undefined;
  return ctx instanceof Response && ctx.status === 402;
}

async function ensureFreshAccessTokenForFunctions(): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    await safeRefreshSession();
    return;
  }
  const exp = session.expires_at;
  if (typeof exp !== "number") return;
  if (exp * 1000 >= Date.now() + 60_000) return;
  await safeRefreshSession();
}

export async function invokePixaiConciergeWithAuth(
  body: object,
): Promise<{ data: unknown; error: unknown }> {
  const invokeOnce = async () => {
    await ensureFreshAccessTokenForFunctions();
    return supabase.functions.invoke("pixai-concierge", { body });
  };

  let { data, error } = await invokeOnce();
  if (error && isFunctionsUnauthorized(error)) {
    try {
      await safeRefreshSession();
    } catch {
      /* ignore */
    }
    ({ data, error } = await invokeOnce());
  }
  return { data, error };
}
