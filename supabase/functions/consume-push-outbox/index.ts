import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

type ExpoTicket = {
  status?: string;
  id?: string;
  message?: string;
  details?: unknown;
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_CHUNK = 99;

function isAuthorized(req: Request, serviceKey: string | undefined): boolean {
  const cronSecret = Deno.env.get("PUSH_CRON_SECRET");
  if (cronSecret) {
    const provided = req.headers.get("x-push-cron-secret") ?? "";
    if (provided === cronSecret) return true;
  }
  if (!serviceKey) return false;
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  return Boolean(bearer && bearer === serviceKey);
}

async function sendExpoChunk(
  messages: ExpoPushMessage[],
): Promise<{ ok: boolean; tickets: ExpoTicket[]; details: unknown }> {
  if (messages.length === 0) return { ok: true, tickets: [], details: { sent: 0 } };
  const expoAccessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "Accept-Encoding": "gzip, deflate",
  };
  if (expoAccessToken) {
    headers.Authorization = `Bearer ${expoAccessToken}`;
  }
  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(messages),
  });
  const json = await res.json().catch(() => ({}));
  const tickets = Array.isArray((json as { data?: unknown }).data)
    ? ((json as { data: ExpoTicket[] }).data ?? [])
    : [];
  if (!res.ok) {
    return { ok: false, tickets, details: { status: res.status, json } };
  }
  const hasHardError = tickets.some((t) => t.status === "error");
  return { ok: !hasHardError, tickets, details: json };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!isAuthorized(req, serviceKey)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { outbox_id?: string; limit?: number };
  try {
    body = (await req.json()) as { outbox_id?: string; limit?: number };
  } catch {
    body = {};
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  type OutboxRow = { id: string; user_id: string; title: string; body: string; data: Record<string, unknown> };

  let rows: OutboxRow[] = [];
  if (typeof body.outbox_id === "string" && body.outbox_id.length > 0) {
    const { data, error } = await admin
      .from("push_outbox")
      .select("id, user_id, title, body, data")
      .eq("id", body.outbox_id)
      .is("delivered_at", null)
      .limit(1);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    rows = (data ?? []) as OutboxRow[];
  } else {
    const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 200);
    const { data, error } = await admin
      .from("push_outbox")
      .select("id, user_id, title, body, data")
      .is("delivered_at", null)
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    rows = (data ?? []) as OutboxRow[];
  }

  const now = new Date().toISOString();
  const expoMessages: ExpoPushMessage[] = [];
  const rowIdsToMark: string[] = [];
  const skippedNoToken: string[] = [];

  for (const row of rows) {
    const { data: tokens, error: tokErr } = await admin
      .from("user_push_tokens")
      .select("expo_push_token")
      .eq("user_id", row.user_id)
      .not("expo_push_token", "is", null);
    if (tokErr) {
      console.error("[consume-push-outbox] tokens", tokErr);
      continue;
    }
    const expoTokens = (tokens ?? [])
      .map((t: { expo_push_token: string | null }) => t.expo_push_token)
      .filter((t): t is string => typeof t === "string" && t.startsWith("ExponentPushToken["));
    if (expoTokens.length === 0) {
      skippedNoToken.push(row.id);
      continue;
    }
    rowIdsToMark.push(row.id);
    for (const to of expoTokens) {
      expoMessages.push({
        to,
        title: row.title,
        body: row.body,
        data: { ...(row.data ?? {}), outbox_id: row.id },
      });
    }
  }

  for (let i = 0; i < expoMessages.length; i += EXPO_CHUNK) {
    const chunk = expoMessages.slice(i, i + EXPO_CHUNK);
    const sendResult = await sendExpoChunk(chunk);
    if (!sendResult.ok) {
      console.error("[consume-push-outbox] Expo error", sendResult.details);
      return new Response(JSON.stringify({ error: "Expo push failed", detail: sendResult.details }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  if (rowIdsToMark.length > 0) {
    await admin.from("push_outbox").update({ delivered_at: now }).in("id", rowIdsToMark);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      processed_rows: rows.length,
      expo_messages: expoMessages.length,
      marked_delivered_ids: rowIdsToMark,
      skipped_no_expo_token_ids: skippedNoToken,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
