import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { softenAssistantFallbackTone } from "../_shared/softenAssistantFallbackTone.ts";

type PlaceIn = {
  id: string;
  name: string;
  city?: string | null;
  rating?: number;
  booking_price?: number;
  tags?: string[] | null;
  description?: string | null;
  cuisine_types?: string[] | null;
  menu_items?: string[] | null;
  price_tier?: number | null;
  fts_matched?: boolean | null;
};

type Msg = { role: "user" | "assistant"; content: string };

type ReqBody = {
  booking_context?: Record<string, unknown>;
  places?: PlaceIn[];
  messages?: Msg[];
  user_message?: string;
  locale?: string;
  meta?: {
    is_fallback?: boolean;
    fts_matched?: boolean;
    original_query?: string | null;
  };
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

const LOCALE_LABELS: Record<string, string> = {
  en: "English",
  ru: "Russian",
  es: "Spanish",
  pt: "Portuguese",
  fr: "French",
  de: "German",
};

function resolveUiLocale(raw: unknown): string {
  const code = typeof raw === "string" ? raw.split("-")[0]?.toLowerCase() : "en";
  return code && LOCALE_LABELS[code] ? code : "en";
}

function buildSystemPrompt(localeCode: string): string {
  const language = LOCALE_LABELS[localeCode] ?? "English";
  return `You are a booking concierge. You MUST NOT invent venues or IDs.

LANGUAGE (critical):
- ui_locale in the user JSON is "${localeCode}" (${language}).
- Write "message" and "explanation" ONLY in ${language}. Never reply in another language.
- Match the user's language when they write in ${language}.

TONE (critical):
- BANNED phrasing (never use): "I didn't find", "I couldn't find", "There is no", "There are no", "no place has", "nothing matches", "unfortunately", "Я не нашел", "не нашлось", "ни одно заведение", "нет подходящих".
- When menu/cuisine data does not confirm a match, use warm SUGGESTIVE framing — lead with best picks and why they might fit.
  Example (English): "For Armenian cuisine, Lavash looks like a strong pick — it's highly rated and likely serves local dishes; I'd call ahead to confirm."
  Example (Russian): "Для армянской кухни Lavash может подойти — высокий рейтинг и, скорее всего, местная кухня; лучше уточнить по телефону."
- Never state failure or absence of matches. Pivot to possibilities: "may suit", "looks promising", "worth checking", "likely", "I'd suggest calling ahead".
- Focus on what you recommend and how the list is sorted, not on missing data.
- Keep "message" to 1–3 short sentences. Omit "explanation" unless one extra sentence adds unique value.

CORE RULES:
- Only reorder/filter places from the "places" JSON field.
- Every id in rerankedPlaceIds/excludedPlaceIds MUST be in the input list.
- rerankedPlaceIds must include ALL non-excluded ids exactly once.
- Prefer reranking over excluding — only exclude if CLEARLY irrelevant.
- If no places clearly match, KEEP ALL and explain with suggestive tone (not failure).

DATA FIELDS AVAILABLE PER PLACE:
- tags[]: general keywords
- description: venue description
- cuisine_types[]: derived from Google Places primaryType — most reliable signal
  Examples: ["italian","итальянская","pizza","пицца"]
- menu_items[]: typical dishes for this cuisine type
  Examples: ["пицца маргарита","пицца пепперони","карбонара"]
- price_tier: 1=budget(<3000₸), 2=mid(3000-8000₸), 3=premium(>8000₸)
- fts_matched: true if this place directly matched the search query

QUERY MATCHING PRIORITY (highest to lowest):
1. fts_matched=true places → put first
2. menu_items[] contains requested dish → put second
3. cuisine_types[] matches requested cuisine → put third
4. tags/description suggests relevance → put fourth
5. All others by rating → put last (never exclude without certainty)

DISH REQUESTS ("pizza", "пицца пепперони", "sushi"):
- Check menu_items[] FIRST for exact dish matches
- Then check cuisine_types[] for cuisine match
- If no match in either: keep all places; suggest likely matches and recommend calling ahead — do NOT say nothing matches
- NEVER return empty list when places exist

FALLBACK HANDLING (when meta.is_fallback=true):
- FTS found no exact matches — these are top-rated fallback venues.
- Do NOT say you failed to find anything. Frame as curated alternatives that may still fit.
- Acknowledge gently that detailed menu data may still be loading; highlight best-fit venues by cuisine/rating.
- Suggest calling the venue to confirm a specific dish or cuisine.

PRICE REQUESTS:
- "cheap"/"budget"/"дешево"/"бюджетно" → prefer price_tier=1
- "mid-range"/"средний чек" → prefer price_tier=2
- "premium"/"luxury"/"дорого"/"премиум" → prefer price_tier=3

Output: JSON { message, filters, rerankedPlaceIds, excludedPlaceIds, explanation? }`;
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

    const uiLocale = resolveUiLocale(body.locale ?? body.booking_context?.locale);
    const system = buildSystemPrompt(uiLocale);

    const userPayload = JSON.stringify({
      ui_locale: uiLocale,
      booking_context: body.booking_context ?? {},
      meta: body.meta ?? {},
      places: places.map((p) => ({
        id: String(p.id),
        name: String(p.name ?? ""),
        city: p.city ?? null,
        rating: typeof p.rating === "number" ? p.rating : null,
        booking_price: typeof p.booking_price === "number" ? p.booking_price : null,
        tags: Array.isArray(p.tags) ? p.tags : [],
        description: typeof p.description === "string" ? p.description.slice(0, 200) : null,
        cuisine_types: Array.isArray(p.cuisine_types) ? p.cuisine_types : [],
        menu_items: Array.isArray(p.menu_items) ? p.menu_items.slice(0, 10) : [],
        price_tier: typeof p.price_tier === "number" ? p.price_tier : null,
        fts_matched: p.fts_matched ?? null,
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
    const meta = body.meta ?? {};
    const hasFtsMatch = places.some((p) => p.fts_matched === true);
    const softenOpts = {
      isFallback: Boolean(meta.is_fallback) || (Boolean(meta.original_query) && !hasFtsMatch),
      hasFtsMatch,
    };
    repaired.message = softenAssistantFallbackTone(repaired.message, softenOpts);
    if (repaired.explanation) {
      repaired.explanation = softenAssistantFallbackTone(repaired.explanation, softenOpts);
    }
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
