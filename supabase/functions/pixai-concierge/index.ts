import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { consumeAiCredits } from "../_shared/consumeAiCredits.ts";
import {
  buildPixaiSearchAssistantLine,
  makePixaiPlaceholderSlots,
  runPixaiPlaceSearch,
  type PixaiSearchFlow,
} from "../_shared/pixaiPlaceSearch.ts";

type SearchBody = {
  action: "search";
  request_id?: string;
  flow: PixaiSearchFlow;
};

type RefineBody = {
  action: "refine";
  request_id?: string;
  booking_context?: Record<string, unknown>;
  places?: unknown[];
  messages?: { role: "user" | "assistant"; content: string }[];
  user_message?: string;
  locale?: string;
  previous_reranked_place_ids?: string[];
  meta?: {
    is_fallback?: boolean;
    fts_matched?: boolean;
    original_query?: string | null;
  };
};

type ConciergeBody = SearchBody | RefineBody;

function parseRequestId(raw: unknown): string {
  return typeof raw === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)
    ? raw
    : crypto.randomUUID();
}

async function forwardRefine(req: Request, body: RefineBody): Promise<Response> {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const auth = req.headers.get("Authorization") ?? "";
  const res = await fetch(`${url}/functions/v1/pixai-booking-chat`, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
      apikey: anonKey,
    },
    body: JSON.stringify({
      request_id: body.request_id,
      booking_context: body.booking_context,
      places: body.places,
      messages: body.messages,
      user_message: body.user_message,
      locale: body.locale,
      previous_reranked_place_ids: body.previous_reranked_place_ids,
      meta: body.meta,
    }),
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseCreditRpcResult(creditData: unknown): { balance: number | null; charged: number } {
  const creditResult =
    creditData && typeof creditData === "object" ? (creditData as Record<string, unknown>) : {};
  const balanceRaw = creditResult.balance;
  const chargedRaw = creditResult.charged;
  const balance =
    typeof balanceRaw === "number"
      ? balanceRaw
      : typeof balanceRaw === "string"
        ? Number(balanceRaw)
        : null;
  const charged =
    typeof chargedRaw === "number"
      ? chargedRaw
      : typeof chargedRaw === "string"
        ? Number(chargedRaw)
        : 0.25;
  return {
    balance: balance != null && Number.isFinite(balance) ? balance : null,
    charged: Number.isFinite(charged) ? charged : 0.25,
  };
}

async function deductConciergeSearchCredits(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  requestId: string,
): Promise<{ balance: number | null; charged: number } | Response> {
  const { data: creditData, error: creditError } = await consumeAiCredits(adminClient, {
    userId,
    delta: 0.25,
    requestId,
  });
  if (creditError?.message.includes("insufficient_ai_credits")) {
    return new Response(JSON.stringify({ error: "insufficient_credits" }), {
      status: 402,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (creditError) {
    console.error("[pixai-concierge] credit deduction failed:", creditError.message);
    return new Response(JSON.stringify({ error: "credit_deduction_failed" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return parseCreditRpcResult(creditData);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as ConciergeBody;
    const requestId = parseRequestId(body.request_id);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "refine") {
      return await forwardRefine(req, { ...body, request_id: requestId });
    }

    if (body.action !== "search" || !body.flow?.mode) {
      return new Response(JSON.stringify({ error: "Missing action or flow" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { places, meta, resolvedCity, effectiveFlow, expandedFromNearby } = await runPixaiPlaceSearch(
      supabase,
      body.flow,
    );

    const assistant = buildPixaiSearchAssistantLine(
      effectiveFlow,
      places.length,
      expandedFromNearby,
      meta.is_fallback,
    );

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    const creditResult = await deductConciergeSearchCredits(adminClient, userData.user.id, requestId);
    if (creditResult instanceof Response) return creditResult;

    return new Response(
      JSON.stringify({
        assistant,
        places,
        slots: makePixaiPlaceholderSlots(),
        meta,
        resolved_city: resolvedCity,
        credits: creditResult,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
