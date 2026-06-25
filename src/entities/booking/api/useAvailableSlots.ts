import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import type { PixAISlot } from "@/entities/pixai";
import { buildSlotsFromBookingTimes, filterSlotsToWindows, localDayBoundsIso, type BookingTimeWindows } from "@/entities/booking/lib/bookingSlots";
import { safeRefreshSession } from "@/shared/lib/supabaseAuth";
import { devWarn } from "@/shared/lib/devLog";

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
export async function fetchAvailableSlotsForDay(businessId: string, dateYmd: string, windows?: BookingTimeWindows): Promise<PixAISlot[]> {
  const bounds = localDayBoundsIso(dateYmd);
  const { data: rpcData, error: rpcError } = await supabase.rpc("get_bookings_datetimes_for_availability", {
    p_business_id: businessId,
    p_start: bounds.start,
    p_end: bounds.endExclusive,
  });

  if (!rpcError) {
    return buildSlotsFromBookingTimes(dateYmd, (rpcData ?? []) as string[], windows);
  }

  devWarn("[available_slots] RPC failed, trying edge:", rpcError.message);

  const { data: edgeData, error: edgeError } = await invokeGetAvailableSlots(businessId, dateYmd);
  if (!edgeError) {
    const raw = edgeData as { slots?: PixAISlot[]; error?: string } | null;
    if (raw && typeof raw.error === "string" && raw.error) throw new Error(raw.error);
    const slots = (raw?.slots ?? []) as PixAISlot[];
    return windows ? filterSlotsToWindows(slots, windows) : slots;
  }

  const edgeDetail = await readEdgeErrorDetail(edgeError);
  throw new Error(`${rpcError.message}${edgeDetail ? ` (${edgeDetail})` : ""}`);
}

export function useAvailableSlots(businessCardId: string | null, dateYmd: string | null, windows?: BookingTimeWindows) {
  return useQuery({
    queryKey: [...queryKeys.availableSlots.forDay(businessCardId, dateYmd), windows ? "restaurant" : "default"],
    queryFn: async () => fetchAvailableSlotsForDay(businessCardId!, dateYmd!, windows),
    enabled: !!businessCardId && !!dateYmd,
  });
}
