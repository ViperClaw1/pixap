import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PixAISlot } from "@/hooks/usePixAI";
import { buildSlotsFromBookingTimes, localDayBoundsIso } from "@/lib/bookingSlots";
import { safeRefreshSession } from "@/lib/supabaseAuth";

function isFunctionsUnauthorized(error: unknown): boolean {
  const ctx =
    error && typeof error === "object" && "context" in error
      ? (error as { context: unknown }).context
      : undefined;
  return ctx instanceof Response && ctx.status === 401;
}

async function readEdgeErrorDetail(error: unknown): Promise<string> {
  if (error && typeof error === "object" && "context" in error) {
    const ctx = (error as { context: unknown }).context;
    if (ctx instanceof Response) {
      try {
        const j = (await ctx.clone().json()) as { error?: string };
        if (typeof j?.error === "string") return j.error;
      } catch {
        try {
          const t = await ctx.clone().text();
          if (t) return t.slice(0, 240);
        } catch {
          /* ignore */
        }
      }
    }
  }
  return error instanceof Error ? error.message : String(error);
}

/** Edge path: explicit Bearer (native invoke merge is unreliable). */
async function invokeGetAvailableSlots(businessId: string, dateYmd: string) {
  const invokeOnce = async () => {
    let { data: sessionData } = await supabase.auth.getSession();
    let token = sessionData.session?.access_token;
    if (!token) {
      await safeRefreshSession();
      ({ data: sessionData } = await supabase.auth.getSession());
      token = sessionData.session?.access_token ?? undefined;
    }
    return supabase.functions.invoke("get-available-slots", {
      body: { business_id: businessId, date: dateYmd },
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
    });
  };

  let { data, error } = await invokeOnce();
  if (error && isFunctionsUnauthorized(error)) {
    await safeRefreshSession();
    ({ data, error } = await invokeOnce());
  }
  return { data, error };
}

/**
 * Prefer DB RPC (no Edge deploy dependency, avoids gateway/404 issues).
 * Falls back to get-available-slots Edge Function if RPC is missing or errors.
 */
async function fetchSlotsWithFallback(businessId: string, dateYmd: string): Promise<PixAISlot[]> {
  const bounds = localDayBoundsIso(dateYmd);
  const { data: rpcData, error: rpcError } = await supabase.rpc("get_bookings_datetimes_for_availability", {
    p_business_id: businessId,
    p_start: bounds.start,
    p_end: bounds.endExclusive,
  });

  if (!rpcError) {
    return buildSlotsFromBookingTimes(dateYmd, (rpcData ?? []) as string[]);
  }

  if (__DEV__) {
    console.warn("[available_slots] RPC failed, trying edge:", rpcError.message);
  }

  const { data: edgeData, error: edgeError } = await invokeGetAvailableSlots(businessId, dateYmd);
  if (!edgeError) {
    const raw = edgeData as { slots?: PixAISlot[]; error?: string } | null;
    if (raw && typeof raw.error === "string" && raw.error) throw new Error(raw.error);
    return (raw?.slots ?? []) as PixAISlot[];
  }

  const edgeDetail = await readEdgeErrorDetail(edgeError);
  throw new Error(`${rpcError.message}${edgeDetail ? ` (${edgeDetail})` : ""}`);
}

export function useAvailableSlots(businessCardId: string | null, dateYmd: string | null) {
  return useQuery({
    queryKey: ["available_slots", businessCardId, dateYmd],
    queryFn: async () => fetchSlotsWithFallback(businessCardId!, dateYmd!),
    enabled: !!businessCardId && !!dateYmd,
  });
}
