import { supabase } from "@/shared/api/supabase/client";
import { safeRefreshSession } from "@/shared/lib/supabaseAuth";

function isFunctionsUnauthorized(error: unknown): boolean {
  const ctx =
    error && typeof error === "object" && "context" in error
      ? (error as { context: unknown }).context
      : undefined;
  return ctx instanceof Response && ctx.status === 401;
}

/** Proactively refresh so the Functions gateway does not reject an expired access_token as Invalid JWT. */
async function ensureFreshAccessTokenForFunctions(): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;
  if (!session.access_token) {
    await safeRefreshSession();
    return;
  }
  const exp = session.expires_at;
  if (typeof exp !== "number") return;
  const expiresAtMs = exp * 1000;
  if (expiresAtMs >= Date.now() + 60_000) return;
  await safeRefreshSession();
}

export async function logPixaiOrchestrateInvokeFailure(error: unknown): Promise<void> {
  if (!__DEV__) return;
  console.warn("[PixAI] pixai-orchestrate invoke failed:", error);
  const ctx =
    error && typeof error === "object" && "context" in error
      ? (error as { context: unknown }).context
      : undefined;
  if (ctx instanceof Response) {
    try {
      const text = await ctx.clone().text();
      if (text) console.warn("[PixAI] edge response body:", text.slice(0, 800));
    } catch {
      /* ignore */
    }
  }
}

/**
 * Edge gateway validates the `Authorization` JWT before the function runs.
 * Do not pass a custom Authorization header: supabase-js `fetchWithAuth` will set it from
 * `getAccessToken()`, but only when the header is absent.
 */
export async function invokePixaiOrchestrateWithAuth(
  body: object,
): Promise<{ data: unknown; error: unknown }> {
  const invokeOnce = async () => {
    await ensureFreshAccessTokenForFunctions();
    return supabase.functions.invoke("pixai-orchestrate", { body });
  };

  let { data, error } = await invokeOnce();
  if (error && isFunctionsUnauthorized(error)) {
    try {
      const refreshed = await safeRefreshSession();
      if (__DEV__ && !refreshed) {
        console.warn("[PixAI] refreshSession after orchestrate 401 skipped (missing/invalid refresh token).");
      }
    } catch (refErr) {
      if (__DEV__) {
        const msg = refErr instanceof Error ? refErr.message : String(refErr);
        console.warn("[PixAI] refreshSession after orchestrate 401 failed:", msg);
      }
    }
    ({ data, error } = await invokeOnce());
  }
  return { data, error };
}
