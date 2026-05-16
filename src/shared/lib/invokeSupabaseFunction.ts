import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/shared/api/supabase/client";
import { safeRefreshSession } from "@/shared/lib/supabaseAuth";

export function isFunctionsUnauthorized(error: unknown): boolean {
  if (error instanceof FunctionsHttpError) {
    return error.context.status === 401;
  }
  const ctx =
    error && typeof error === "object" && "context" in error
      ? (error as { context: unknown }).context
      : undefined;
  return ctx instanceof Response && ctx.status === 401;
}

export async function formatFunctionsError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.text().catch(() => "");
    return `${error.message} (${error.context.status})${body ? `: ${body.slice(0, 300)}` : ""}`;
  }
  if (error instanceof Error) return error.message;
  return String(error ?? "Unknown error");
}

export async function ensureFreshAccessTokenForFunctions(): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return safeRefreshSession();
  }
  const exp = session.expires_at;
  if (typeof exp !== "number") return true;
  if (exp * 1000 >= Date.now() + 60_000) return true;
  return safeRefreshSession();
}

export async function invokeSupabaseFunctionWithAuth<T = unknown>(
  name: string,
  body: Record<string, unknown>,
): Promise<{ data: T | null; error: unknown }> {
  const invokeOnce = async () => {
    await ensureFreshAccessTokenForFunctions();
    return supabase.functions.invoke<T>(name, { body });
  };

  let { data, error } = await invokeOnce();
  if (error && isFunctionsUnauthorized(error)) {
    await safeRefreshSession();
    ({ data, error } = await invokeOnce());
  }
  return { data: data ?? null, error: error ?? null };
}
