import { supabase } from "@/shared/api/supabase/client";
import { safeRefreshSession } from "@/shared/lib/supabaseAuth";
import type { AiBookingChatResult } from "../model/types";

function isFunctionsUnauthorized(error: unknown): boolean {
  const ctx =
    error && typeof error === "object" && "context" in error
      ? (error as { context: unknown }).context
      : undefined;
  return ctx instanceof Response && ctx.status === 401;
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

export async function invokePixaiBookingChatWithAuth(body: object): Promise<{ data: unknown; error: unknown }> {
  const invokeOnce = async () => {
    await ensureFreshAccessTokenForFunctions();
    return supabase.functions.invoke("pixai-booking-chat", { body });
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

export function parseAiBookingChatResponse(data: unknown): AiBookingChatResult {
  if (!data || typeof data !== "object") {
    throw new Error("Empty response from assistant");
  }
  const o = data as Record<string, unknown>;
  const message = typeof o.message === "string" ? o.message : "";
  const filters = o.filters != null && typeof o.filters === "object" && !Array.isArray(o.filters) ? (o.filters as Record<string, unknown>) : {};
  const rerankedPlaceIds = Array.isArray(o.rerankedPlaceIds)
    ? (o.rerankedPlaceIds as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const excludedPlaceIds = Array.isArray(o.excludedPlaceIds)
    ? (o.excludedPlaceIds as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const explanation = typeof o.explanation === "string" ? o.explanation : undefined;
  return { message, filters, rerankedPlaceIds, excludedPlaceIds, explanation };
}
