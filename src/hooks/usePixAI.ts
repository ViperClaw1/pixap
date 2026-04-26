import { useCallback, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { BusinessCard } from "@/hooks/useBusinessCards";
import { normalizeBusinessCardImages } from "@/lib/businessCardImages";
import { safeRefreshSession } from "@/lib/supabaseAuth";

export type PixAIPlace = Pick<BusinessCard, "id" | "name" | "address" | "city" | "rating" | "booking_price" | "images">;

export type PixAISlot = {
  label: string;
  dateTimeIso: string;
  available: boolean;
  isBest: boolean;
};

export type PixAIBookingDraft = {
  business_card_id: string;
  date_time: string;
  cost: number;
  persons: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  comment?: string | null;
};

export type PixAIToolResult = {
  places?: PixAIPlace[];
  slots?: PixAISlot[];
  draft?: PixAIBookingDraft;
};

export type PixAIMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  toolResult?: PixAIToolResult;
};

type OrchestratorResponse = {
  assistant: string;
  places?: PixAIPlace[];
  slots?: PixAISlot[];
  draft?: PixAIBookingDraft;
};

type FlowRunResult = OrchestratorResponse & { catalogFallback?: boolean };

function buildFlowUserSummary(flow: PixAIFlowPayload): string {
  const summaryParts = [
    flow.city,
    flow.isRestaurantTable ? "Restaurant table" : (flow.categoryName ?? "Service"),
    flow.mode === "nearby" ? "Near me (5 miles)" : "All places in city",
  ];
  if (flow.comment?.trim()) summaryParts.push(`Comment: ${flow.comment.trim()}`);
  return `Find: ${summaryParts.join(" | ")}`;
}

/** Same tone as the edge `buildAssistant` for successful searches (no “service unavailable” wording). */
function buildAssistantFromFlow(flow: PixAIFlowPayload, placeCount: number): string {
  if (placeCount === 0) {
    return "I could not find matching places. Try changing city, category, or search scope.";
  }
  const cityLabel = flow.city.trim() || "your city";
  const requestType = flow.isRestaurantTable ? "restaurant tables" : "services";
  const scopeText = flow.mode === "nearby" ? "near you" : `in ${cityLabel}`;
  return `I found ${placeCount} ${requestType} ${scopeText}. Pick one and I will suggest the best available slots.`;
}

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

async function logEdgeInvokeFailure(error: unknown): Promise<void> {
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
 * `getAccessToken()`, but only when the header is absent. A manual Bearer token blocks that
 * and keeps sending an expired access_token → `{"code":401,"message":"Invalid JWT"}`.
 */
async function invokePixaiOrchestrateWithAuth(body: object): Promise<{ data: unknown; error: unknown }> {
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

export type PixAISearchMode = "nearby" | "city";

export type PixAIFlowPayload = {
  city: string;
  categoryId?: string;
  categoryName?: string;
  isRestaurantTable?: boolean;
  comment?: string;
  mode: PixAISearchMode;
  radiusMiles?: number;
  location?: { lat: number; lng: number };
  limit?: number;
};

const slotHours = [10, 11, 12, 13, 14, 16, 17, 18];

function makeLocalSlots(): PixAISlot[] {
  const base = new Date();
  base.setMinutes(0, 0, 0);
  if (base.getHours() > 18) {
    base.setDate(base.getDate() + 1);
    base.setHours(10, 0, 0, 0);
  } else {
    base.setHours(Math.max(10, base.getHours() + 1), 0, 0, 0);
  }
  return slotHours.map((h, idx) => {
    const d = new Date(base);
    d.setHours(h, 0, 0, 0);
    return {
      label: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      dateTimeIso: d.toISOString(),
      available: idx !== 2,
      isBest: false,
    };
  });
}

type LooseRpcClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>;
};

function mapRowsToPlaces(rows: unknown): PixAIPlace[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    const images = normalizeBusinessCardImages(r.images as string[] | null | undefined);
    const legacyImage = r.image != null && String(r.image).trim() ? [String(r.image)] : [];
    return {
      id: String(r.id),
      name: String(r.name ?? ""),
      address: r.address != null ? String(r.address) : "",
      city: r.city != null ? String(r.city) : null,
      rating: Number(r.rating ?? 0),
      booking_price: Number(r.booking_price ?? 0),
      images: images.length > 0 ? images : normalizeBusinessCardImages(legacyImage),
    };
  });
}

/** When the edge function fails, run the same search against the DB with the user JWT (RPCs + table fallback). */
async function fetchPlacesWhenOrchestratorFails(flow: PixAIFlowPayload): Promise<PixAIPlace[]> {
  const limit = Math.max(3, Math.min(flow.limit ?? 8, 20));
  const city = flow.city.trim();
  const categoryId = flow.isRestaurantTable ? null : flow.categoryId?.trim() ?? null;
  const categoryName = flow.isRestaurantTable ? null : flow.categoryName?.trim() ?? null;
  const rpc = supabase as unknown as LooseRpcClient;

  let places: PixAIPlace[] = [];
  const triedNearby = flow.mode === "nearby" && flow.location != null;

  if (triedNearby && flow.location) {
    const nearbyBase: Record<string, unknown> = {
      p_latitude: flow.location.lat,
      p_longitude: flow.location.lng,
      p_radius_miles: flow.radiusMiles ?? 5,
      p_city: city,
      p_category_id: categoryId,
      p_is_restaurant_table: flow.isRestaurantTable ?? false,
      p_limit: limit,
    };
    let { data, error } = await rpc.rpc("search_business_cards_nearby", {
      ...nearbyBase,
      p_category_name: categoryName,
    });
    if (error) {
      ({ data, error } = await rpc.rpc("search_business_cards_nearby", nearbyBase));
    }
    if (!error) places = mapRowsToPlaces(data);
  }

  if (places.length === 0) {
    const { data, error } = await rpc.rpc("search_business_cards_in_city", {
      p_city: city,
      p_category_id: categoryId,
      p_is_restaurant_table: flow.isRestaurantTable ?? false,
      p_limit: limit,
      p_category_name: categoryName,
    });
    if (!error) {
      places = mapRowsToPlaces(data);
    } else {
      let q = supabase
        .from("business_cards")
        .select("id, name, address, city, rating, booking_price, images")
        .ilike("city", city)
        .order("rating", { ascending: false })
        .limit(limit);
      if (categoryId) q = q.eq("category_id", categoryId);
      if (flow.isRestaurantTable) {
        q = q.or("name.ilike.%restaurant%,tags.cs.{restaurant},tags.cs.{table}");
      }
      const { data: rows } = await q;
      places = mapRowsToPlaces(rows ?? []);
    }
  }

  if (places.length === 0 && city) {
    const { data: rows } = await supabase
      .from("business_cards")
      .select("id, name, address, city, rating, booking_price, images")
      .eq("city", city)
      .order("rating", { ascending: false })
      .limit(3);
    places = mapRowsToPlaces(rows ?? []);
  }

  return places;
}

export function usePixAI() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<PixAIMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi, I am PixAI. Tell me what service you want and I will find places, suggest the best slot, and prepare your booking.",
    },
  ]);

  const flowMutation = useMutation({
    mutationFn: async (flow: PixAIFlowPayload): Promise<FlowRunResult> => {
      const { data, error } = await invokePixaiOrchestrateWithAuth({
        flow,
        user_id: user?.id ?? null,
        history: messages.map((m) => ({ role: m.role, content: m.content })),
      });
      if (!error && data != null) {
        return { ...(data as OrchestratorResponse), catalogFallback: false };
      }
      await logEdgeInvokeFailure(error);
      const places = await fetchPlacesWhenOrchestratorFails(flow);
      if (places.length > 0) {
        if (__DEV__) {
          console.info("[PixAI] edge invoke failed; showing results from direct DB search (same filters as orchestrator).");
        }
        return {
          assistant: buildAssistantFromFlow(flow, places.length),
          places,
          slots: makeLocalSlots(),
          catalogFallback: true,
        };
      }
      throw error ?? new Error("PixAI orchestrator failed");
    },
    onSuccess: (payload, flow) => {
      setMessages((prev) => [
        ...prev,
        { id: `u-${Date.now()}`, role: "user", content: buildFlowUserSummary(flow) },
        {
          id: `a-${Date.now() + 1}`,
          role: "assistant",
          content: payload.assistant,
          toolResult: {
            places: payload.places,
            slots: payload.slots,
            draft: payload.draft,
          },
        },
      ]);
    },
    onError: async (error, flow) => {
      if (__DEV__) {
        console.warn("[PixAI] search failed (edge and local DB returned no places):", error);
      }
      setMessages((prev) => [
        ...prev,
        { id: `u-${Date.now()}`, role: "user", content: buildFlowUserSummary(flow) },
        {
          id: `a-${Date.now() + 1}`,
          role: "assistant",
          content:
            "Something went wrong with the booking assistant and no matching places were found. Check your connection, try again, or adjust city and category.",
          toolResult: {
            places: [],
            slots: makeLocalSlots(),
          },
        },
      ]);
    },
  });

  const runFlow = useCallback(
    async (flow: PixAIFlowPayload) => {
      await flowMutation.mutateAsync(flow);
    },
    [flowMutation],
  );

  return useMemo(
    () => ({
      messages,
      runFlow,
      isLoading: flowMutation.isPending,
    }),
    [flowMutation.isPending, messages, runFlow],
  );
}
