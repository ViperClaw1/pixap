import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { i18n } from "@/shared/lib/i18n";
import { supabase } from "@/shared/api/supabase/client";
import { devInfo, devWarn } from "@/shared/lib/devLog";
import { useAuth } from "@/app/providers/AuthProvider";
import type { BusinessCard } from "@/entities/business-card";
import { PIXAI_BUSINESS_CARD_SELECT, localizeBusinessCard } from "@/entities/business-card";
import { normalizeBusinessCardImages } from "@/shared/lib/business-card/businessCardImages";
import { normalizeBusinessCardBlurhashes } from "@/shared/lib/business-card/businessCardBlurhash";
import { invokePixaiOrchestrateWithAuth, logPixaiOrchestrateInvokeFailure } from "./invokePixaiOrchestrate";
import {
  getBookingAssistantGreetingText,
  PIXAI_WELCOME_MESSAGE_ID,
} from "@/entities/pixai/lib/bookingAssistantCopy";
import { buildFlowUserSummary } from "../lib/buildFlowUserSummary";
import { buildSearchResultsLineFromFlow } from "../lib/buildSearchResultsAssistantLine";
import { expandQuery } from "../lib/queryExpansion";
import { buildPixAISearchMeta, type PixAISearchMeta } from "../model/searchMeta";

export type { PixAISearchMeta };

export type PixAIPlace = Pick<
  BusinessCard,
  "id" | "name" | "address" | "city" | "rating" | "booking_price" | "images" | "tags" | "blurhashes"
> & {
  cuisine_types?: string[];
  menu_items?: string[];
  price_tier?: number | null;
  fts_matched?: boolean | null;
};

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

export type PixAIVibeTimeline = "day" | "evening" | "night" | "late_night";

export type PixAIVibePayload = {
  mood: string;
  timeline: PixAIVibeTimeline;
  city?: string;
  limit?: number;
};

export type VibePlanStop = {
  venue_id: string;
  name: string;
  time_slot: string;
  vibe_score: number;
  description: string;
  booking_price: number;
  is_restaurant_table: boolean;
  address?: string;
  city?: string;
  latitude?: number | null;
  longitude?: number | null;
  rating?: number;
  images?: string[];
};

export type VibePlanResult = {
  assistant: string;
  plan: VibePlanStop[];
};

type OrchestratorResponse = {
  assistant: string;
  places?: PixAIPlace[];
  slots?: PixAISlot[];
  draft?: PixAIBookingDraft;
  plan?: unknown;
  meta?: PixAISearchMeta;
};

export type FlowRunResult = OrchestratorResponse & { catalogFallback?: boolean };

function parseVibeStops(raw: unknown): VibePlanStop[] {
  if (!Array.isArray(raw)) return [];
  const out: VibePlanStop[] = [];
  for (const row of raw) {
    const r = row as Record<string, unknown>;
    const id = r.venue_id ?? r.id;
    if (id == null) continue;
    const imagesRaw = r.images;
    const images = Array.isArray(imagesRaw)
      ? (imagesRaw as unknown[]).filter((x): x is string => typeof x === "string")
      : undefined;
    out.push({
      venue_id: String(id),
      name: String(r.name ?? ""),
      time_slot: String(r.time_slot ?? ""),
      vibe_score: Number(r.vibe_score ?? 0),
      description: String(r.description ?? ""),
      booking_price: Number(r.booking_price ?? 0),
      is_restaurant_table: Boolean(r.is_restaurant_table),
      address: r.address != null ? String(r.address) : undefined,
      city: r.city != null ? String(r.city) : undefined,
      rating: r.rating != null ? Number(r.rating) : undefined,
      latitude: r.latitude != null ? Number(r.latitude) : undefined,
      longitude: r.longitude != null ? Number(r.longitude) : undefined,
      images,
    });
  }
  return out;
}

function buildAssistantFromFlow(flow: PixAIFlowPayload, placeCount: number): string {
  return buildSearchResultsLineFromFlow(flow, placeCount);
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

function mapRowsToPlaces(rows: unknown, language: string): PixAIPlace[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    const images = normalizeBusinessCardImages(r.images as string[] | null | undefined);
    const legacyImage = r.image != null && String(r.image).trim() ? [String(r.image)] : [];
    const localized = localizeBusinessCard(r as Parameters<typeof localizeBusinessCard>[0], language);
    return {
      id: String(r.id),
      name: localized.name,
      address: r.address != null ? String(r.address) : "",
      city: r.city != null ? String(r.city) : null,
      rating: Number(r.rating ?? 0),
      booking_price: Number(r.booking_price ?? 0),
      images: images.length > 0 ? images : normalizeBusinessCardImages(legacyImage),
      blurhashes: normalizeBusinessCardBlurhashes(r.blurhashes),
      tags: localized.tags ?? [],
      cuisine_types: Array.isArray(r.cuisine_types)
        ? (r.cuisine_types as unknown[]).filter((x): x is string => typeof x === "string")
        : [],
      menu_items: Array.isArray(r.menu_items)
        ? (r.menu_items as unknown[]).filter((x): x is string => typeof x === "string")
        : [],
      price_tier: typeof r.price_tier === "number" ? r.price_tier : null,
      fts_matched: r.fts_matched === true ? true : r.fts_matched === false ? false : null,
    };
  });
}

/** When the edge function fails, run the same search against the DB with the user JWT (RPCs + table fallback). */
async function fetchPlacesWhenOrchestratorFails(flow: PixAIFlowPayload, language: string): Promise<PixAIPlace[]> {
  const limit = Math.max(3, Math.min(flow.limit ?? 8, 20));
  const city = flow.city.trim();
  const categoryId = flow.isRestaurantTable ? null : flow.categoryId?.trim() ?? null;
  const categoryName = flow.isRestaurantTable ? null : flow.categoryName?.trim() ?? null;
  const rpc = supabase as unknown as LooseRpcClient;

  let places: PixAIPlace[] = [];
  const triedNearby = flow.mode === "nearby" && flow.location != null;

  const query = expandQuery((flow.comment ?? "").trim()) || null;

  if (triedNearby && flow.location) {
    const nearbyBase: Record<string, unknown> = {
      p_latitude: flow.location.lat,
      p_longitude: flow.location.lng,
      p_radius_miles: flow.radiusMiles ?? 5,
      p_city: city,
      p_category_id: categoryId,
      p_is_restaurant_table: flow.isRestaurantTable ?? false,
      p_limit: limit,
      p_query: query,
    };
    let { data, error } = await rpc.rpc("search_business_cards_nearby", {
      ...nearbyBase,
      p_category_name: categoryName,
    });
    if (error) {
      ({ data, error } = await rpc.rpc("search_business_cards_nearby", nearbyBase));
    }
    if (!error) places = mapRowsToPlaces(data, language);
  }

  if (places.length === 0) {
    const { data, error } = await rpc.rpc("search_business_cards_in_city", {
      p_city: city,
      p_category_id: categoryId,
      p_is_restaurant_table: flow.isRestaurantTable ?? false,
      p_limit: limit,
      p_category_name: categoryName,
      p_query: query,
    });
    if (!error) {
      places = mapRowsToPlaces(data, language);
    } else {
      let q = supabase
        .from("business_cards")
        .select(PIXAI_BUSINESS_CARD_SELECT as never)
        .ilike("city", city)
        .order("rating", { ascending: false })
        .limit(limit);
      if (categoryId) q = q.eq("category_id", categoryId);
      if (flow.isRestaurantTable) {
        q = q.or("name.ilike.%restaurant%,tags.cs.{restaurant},tags.cs.{table}");
      }
      const { data: rows } = await q;
      places = mapRowsToPlaces(rows ?? [], language);
    }
  }

  if (places.length === 0 && city) {
    const { data: rows } = await supabase
      .from("business_cards")
      .select(PIXAI_BUSINESS_CARD_SELECT as never)
      .eq("city", city)
      .order("rating", { ascending: false })
      .limit(3);
    places = mapRowsToPlaces(rows ?? [], language);
  }

  return places;
}

function keepWelcomeMessageOnly(prev: PixAIMessage[]): PixAIMessage[] {
  return prev.filter((m) => m.id === PIXAI_WELCOME_MESSAGE_ID);
}

function buildFlowSearchTranscript(
  flow: PixAIFlowPayload,
  assistantContent: string,
  toolResult: PixAIToolResult,
): PixAIMessage[] {
  const now = Date.now();
  return [
    { id: `u-${now}`, role: "user", content: buildFlowUserSummary(flow) },
    {
      id: `a-${now + 1}`,
      role: "assistant",
      content: assistantContent,
      toolResult,
    },
  ];
}

export function usePixAI() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<PixAIMessage[]>(() => [
    {
      id: PIXAI_WELCOME_MESSAGE_ID,
      role: "assistant",
      content: getBookingAssistantGreetingText(),
    },
  ]);

  useEffect(() => {
    const greeting = getBookingAssistantGreetingText();
    setMessages((prev) =>
      prev.map((m) => (m.id === PIXAI_WELCOME_MESSAGE_ID ? { ...m, content: greeting } : m)),
    );
  }, [i18n.language]);

  const flowMutation = useMutation({
    mutationFn: async (flow: PixAIFlowPayload): Promise<FlowRunResult> => {
      const { data, error } = await invokePixaiOrchestrateWithAuth({
        flow,
        user_id: user?.id ?? null,
        history: messages.map((m) => ({ role: m.role, content: m.content })),
      });
      if (!error && data != null) {
        const payload = data as OrchestratorResponse;
        const places = payload.places != null ? mapRowsToPlaces(payload.places, i18n.language) : undefined;
        const meta =
          payload.meta ??
          buildPixAISearchMeta((flow.comment ?? "").trim() || null, places ?? []);
        return {
          ...payload,
          places,
          meta,
          catalogFallback: false,
        };
      }
      await logPixaiOrchestrateInvokeFailure(error);
      const places = await fetchPlacesWhenOrchestratorFails(flow, i18n.language);
      if (places.length > 0) {
        devInfo("[PixAI] edge invoke failed; showing results from direct DB search (same filters as orchestrator).");
        return {
          assistant: buildAssistantFromFlow(flow, places.length),
          places,
          slots: makeLocalSlots(),
          meta: buildPixAISearchMeta((flow.comment ?? "").trim() || null, places),
          catalogFallback: true,
        };
      }
      throw error ?? new Error("PixAI orchestrator failed");
    },
    onSuccess: (payload, flow) => {
      const placeCount = payload.places?.length ?? 0;
      const assistantContent =
        payload.catalogFallback && placeCount > 0
          ? buildSearchResultsLineFromFlow(flow, placeCount)
          : payload.assistant;
      setMessages((prev) => [
        ...keepWelcomeMessageOnly(prev),
        ...buildFlowSearchTranscript(flow, assistantContent, {
          places: payload.places,
          slots: payload.slots,
          draft: payload.draft,
        }),
      ]);
    },
    onError: async (error, flow) => {
      devWarn("[PixAI] search failed (edge and local DB returned no places):", error);
      setMessages((prev) => [
        ...keepWelcomeMessageOnly(prev),
        ...buildFlowSearchTranscript(
          flow,
          i18n.t("aiBooking.searchOrchestratorFailed"),
          {
            places: [],
            slots: makeLocalSlots(),
          },
        ),
      ]);
    },
  });

  const vibeMutation = useMutation({
    mutationFn: async (vibe: PixAIVibePayload): Promise<VibePlanResult> => {
      const { data, error } = await invokePixaiOrchestrateWithAuth({
        vibe: {
          mood: vibe.mood.trim(),
          timeline: vibe.timeline,
          ...(vibe.city?.trim() ? { city: vibe.city.trim() } : {}),
          ...(vibe.limit != null ? { limit: vibe.limit } : {}),
        },
      });
      if (error) {
        await logPixaiOrchestrateInvokeFailure(error);
        throw error;
      }
      const o = (data ?? {}) as OrchestratorResponse;
      return {
        assistant: typeof o.assistant === "string" ? o.assistant : "",
        plan: parseVibeStops(o.plan),
      };
    },
  });

  const runFlow = useCallback(
    async (flow: PixAIFlowPayload): Promise<FlowRunResult> => {
      return flowMutation.mutateAsync(flow);
    },
    [flowMutation],
  );

  const runVibePlan = useCallback(
    async (vibe: PixAIVibePayload) => {
      await vibeMutation.mutateAsync(vibe);
    },
    [vibeMutation],
  );

  const resetVibePlan = useCallback(() => {
    vibeMutation.reset();
  }, [vibeMutation]);

  const resetFlowSearchTranscript = useCallback(() => {
    setMessages((prev) => keepWelcomeMessageOnly(prev));
  }, []);

  return useMemo(
    () => ({
      messages,
      runFlow,
      isLoading: flowMutation.isPending,
      resetFlowSearchTranscript,
      runVibePlan,
      isVibeLoading: vibeMutation.isPending,
      vibeResult: vibeMutation.data ?? null,
      vibeError: vibeMutation.error,
      resetVibePlan,
    }),
    [
      flowMutation.isPending,
      messages,
      resetFlowSearchTranscript,
      resetVibePlan,
      runFlow,
      runVibePlan,
      vibeMutation.data,
      vibeMutation.error,
      vibeMutation.isPending,
    ],
  );
}
