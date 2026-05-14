import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type PlaceIn = {
  id: string;
  name: string;
  city?: string | null;
  rating?: number;
  booking_price?: number;
};

type Msg = { role: "user" | "assistant"; content: string };

type ReqBody = {
  booking_context?: Record<string, unknown>;
  places?: PlaceIn[];
  messages?: Msg[];
  user_message?: string;
};

type AiShape = {
  message: string;
  filters: Record<string, unknown>;
  rerankedPlaceIds: string[];
  excludedPlaceIds: string[];
  explanation?: string;
};

function extractJsonObject(text: string): unknown {
  let t = text.trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)```$/im);
  if (fence) t = fence[1]!.trim();
  return JSON.parse(t) as unknown;
}

function clampHistory(messages: Msg[], max = 24): Msg[] {
  if (messages.length <= max) return messages;
  return messages.slice(messages.length - max);
}

function validateAndRepairShape(raw: unknown, places: PlaceIn[]): AiShape {
  const orderedIds = places.map((p) => String(p.id));
  const allowedIds = new Set(orderedIds);
  const base: AiShape = {
    message: "Here are places from your current results, re-ordered for what you asked.",
    filters: {},
    rerankedPlaceIds: [...orderedIds],
    excludedPlaceIds: [],
  };
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const message = typeof o.message === "string" && o.message.trim() ? o.message.trim() : base.message;
  const filters =
    o.filters != null && typeof o.filters === "object" && !Array.isArray(o.filters)
      ? (o.filters as Record<string, unknown>)
      : {};
  const rerankRaw = Array.isArray(o.rerankedPlaceIds) ? o.rerankedPlaceIds : [];
  const exclRaw = Array.isArray(o.excludedPlaceIds) ? o.excludedPlaceIds : [];
  const excludedPlaceIds = exclRaw
    .map((x) => (typeof x === "string" ? x : ""))
    .filter((id) => allowedIds.has(id));
  const exclSet = new Set(excludedPlaceIds);
  const visibleOrdered = orderedIds.filter((id) => !exclSet.has(id));

  const headCandidates = rerankRaw
    .map((x) => (typeof x === "string" ? x : ""))
    .filter((id) => allowedIds.has(id) && !exclSet.has(id));
  const seen = new Set<string>();
  const head = headCandidates.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  const tail = visibleOrdered.filter((id) => !seen.has(id));
  const rerankedPlaceIds = [...head, ...tail];
  const explanation = typeof o.explanation === "string" ? o.explanation : undefined;
  return { message, filters, rerankedPlaceIds, excludedPlaceIds, explanation };
}

/**
 * Models are tried in order until `generateContent` succeeds (404/403 → next).
 * Override order with secret `GEMINI_MODEL` (single id tried first).
 * @see https://ai.google.dev/api/rest/v1beta/models
 */
const MODEL_FALLBACK_CHAIN = [
  "gemini-2.5-flash",
  "gemini-3-flash-preview",
  "gemini-2.5-flash-preview",
  "gemini-1.5-flash-002",
  "gemini-1.5-flash-8b",
  "gemini-2.0-flash-001",
] as const;

function buildCandidateModels(): string[] {
  const env = (Deno.env.get("GEMINI_MODEL") ?? "").trim();
  const out: string[] = [];
  if (env) out.push(env);
  for (const m of MODEL_FALLBACK_CHAIN) {
    if (!out.includes(m)) out.push(m);
  }
  return out;
}

type GeminiTryOk = { kind: "ok"; modelUsed: string; data: unknown };
type GeminiTryHttp = { kind: "http"; modelId: string; status: number; body: string };

async function tryGeminiGenerate(args: {
  system: string;
  userPayload: string;
  apiKey: string;
  modelId: string;
}): Promise<GeminiTryOk | GeminiTryHttp> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(args.modelId)}:generateContent`;
  const body = {
    systemInstruction: { parts: [{ text: args.system }] },
    contents: [
      {
        role: "user",
        parts: [{ text: args.userPayload }],
      },
    ],
    generationConfig: {
      temperature: 0.35,
      responseMimeType: "application/json",
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": args.apiKey,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    return { kind: "http", modelId: args.modelId, status: res.status, body: text.slice(0, 600) };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { kind: "http", modelId: args.modelId, status: 502, body: "Invalid Gemini response envelope" };
  }
  const p = parsed as Record<string, unknown>;
  const candidates = p.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return { kind: "http", modelId: args.modelId, status: 502, body: "No candidates from Gemini" };
  }
  const parts = (candidates[0] as Record<string, unknown>)?.content as Record<string, unknown> | undefined;
  const partsArr = parts?.parts;
  if (!Array.isArray(partsArr) || partsArr.length === 0) {
    return { kind: "http", modelId: args.modelId, status: 502, body: "No content parts from Gemini" };
  }
  const t = (partsArr[0] as Record<string, unknown>)?.text;
  if (typeof t !== "string" || !t.trim()) {
    return { kind: "http", modelId: args.modelId, status: 502, body: "Empty model text" };
  }
  try {
    const data = extractJsonObject(t);
    return { kind: "ok", modelUsed: args.modelId, data };
  } catch {
    return { kind: "http", modelId: args.modelId, status: 502, body: "Model text was not valid JSON" };
  }
}

async function callGeminiJsonWithModelFallback(args: {
  system: string;
  userPayload: string;
  apiKey: string;
}): Promise<unknown> {
  const models = buildCandidateModels();
  let lastHttp: GeminiTryHttp | null = null;
  for (const modelId of models) {
    const r = await tryGeminiGenerate({ ...args, modelId });
    if (r.kind === "ok") {
      if (modelId !== models[0]) {
        console.info("[pixai-booking-chat] Gemini model in use:", r.modelUsed);
      }
      return r.data;
    }
    lastHttp = r;
    if (r.status !== 404 && r.status !== 403) {
      console.error("[pixai-booking-chat] Gemini HTTP", r.modelId, r.status, r.body);
      throw new Error(`Gemini error (${r.status})`);
    }
    console.warn("[pixai-booking-chat] Model unavailable, next:", r.modelId, r.status);
  }
  if (lastHttp) {
    console.error("[pixai-booking-chat] All models failed", lastHttp.modelId, lastHttp.status, lastHttp.body);
    throw new Error(`Gemini error (${lastHttp.status})`);
  }
  throw new Error("Gemini: no model candidates");
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

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
    const { data: userData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as ReqBody;
    const places = Array.isArray(body.places) ? body.places : [];
    const userMessage = typeof body.user_message === "string" ? body.user_message.trim() : "";
    if (!userMessage) {
      return new Response(JSON.stringify({ error: "user_message required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (places.length === 0) {
      return new Response(
        JSON.stringify({
          message: "There are no places in the current list to refine. Run a new search first.",
          filters: {},
          rerankedPlaceIds: [],
          excludedPlaceIds: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const history = clampHistory(
      Array.isArray(body.messages)
        ? body.messages.filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        : [],
    );

    const apiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
    if (!apiKey) {
      const ids = places.map((p) => String(p.id));
      return new Response(
        JSON.stringify({
          message: "AI assistant is not configured on the server yet.",
          filters: {},
          rerankedPlaceIds: ids,
          excludedPlaceIds: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const system = `You are a booking concierge for an app. You MUST NOT invent venues or IDs.
Rules:
- You only reorder, filter, or annotate the places provided in the JSON field "places". Every id in rerankedPlaceIds and excludedPlaceIds MUST appear in that input list.
- rerankedPlaceIds should list ALL place ids you want visible in order (after exclusions). Include every non-excluded id exactly once.
- excludedPlaceIds lists ids to hide from the list entirely.
- filters is a small JSON object of interpreted preferences (budget_max, vibe keywords, etc.) when inferable; otherwise {}.
- message: short helpful reply to the user (plain text).
- explanation: optional one-line rationale.
Output must be a single JSON object with keys: message (string), filters (object), rerankedPlaceIds (string[]), excludedPlaceIds (string[]), explanation (string, optional).`;

    const userPayload = JSON.stringify({
      booking_context: body.booking_context ?? {},
      places: places.map((p) => ({
        id: String(p.id),
        name: String(p.name ?? ""),
        city: p.city ?? null,
        rating: typeof p.rating === "number" ? p.rating : null,
        booking_price: typeof p.booking_price === "number" ? p.booking_price : null,
      })),
      conversation: history,
      user_message: userMessage,
    });

    let rawModel: unknown;
    try {
      rawModel = await callGeminiJsonWithModelFallback({ system, userPayload, apiKey });
    } catch (e) {
      console.error("[pixai-booking-chat] Gemini failed:", (e as Error)?.message ?? e);
      return new Response(
        JSON.stringify({
          message: "The assistant is temporarily unavailable. Your list is unchanged.",
          filters: {},
          rerankedPlaceIds: places.map((p) => String(p.id)),
          excludedPlaceIds: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const repaired = validateAndRepairShape(rawModel, places);
    return new Response(JSON.stringify(repaired), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
