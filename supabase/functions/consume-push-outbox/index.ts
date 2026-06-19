import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const ANDROID_PUSH_CHANNEL_ID = "pixap-default";

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  sound?: "default";
  priority?: "default" | "normal" | "high";
  channelId?: string;
  data?: Record<string, unknown>;
};

type ExpoTicket = {
  status?: string;
  id?: string;
  message?: string;
  details?: unknown;
};

type AuthScope =
  | { mode: "service" }
  | { mode: "user"; userId: string };

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_CHUNK = 99;

function isServiceAuthorized(req: Request, serviceKey: string | undefined): boolean {
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

async function resolveAuthScope(req: Request, url: string, serviceKey: string): Promise<AuthScope | null> {
  if (isServiceAuthorized(req, serviceKey)) {
    return { mode: "service" };
  }

  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user?.id) {
    console.warn("[consume-push-outbox] auth.getUser failed:", error?.message ?? "no user");
    return null;
  }
  return { mode: "user", userId: data.user.id };
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

type OutboxRow = { id: string; user_id: string; title: string; body: string; data: Record<string, unknown> };

const SOCIAL_PUSH_KINDS = new Set([
  "post_like",
  "story_like",
  "post_comment",
  "story_comment",
  "story_reply",
]);

function readUuidField(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Resolve delivery target: `data.recipient_id` is authoritative for social events. */
function resolveDeliveryUserId(row: OutboxRow): string {
  const kind = typeof row.data?.kind === "string" ? row.data.kind : "";
  if (SOCIAL_PUSH_KINDS.has(kind)) {
    return readUuidField(row.data, "recipient_id") ?? row.user_id;
  }
  return row.user_id;
}

/** Skip rows that would notify the user who performed the action. */
function isPushForActor(row: OutboxRow): boolean {
  const actorId = readUuidField(row.data, "actor_id") ?? readUuidField(row.data, "sender_id");
  const deliveryUserId = resolveDeliveryUserId(row);
  if (actorId && actorId === deliveryUserId) {
    return true;
  }
  if (actorId && actorId === row.user_id) {
    return true;
  }
  const recipientId = readUuidField(row.data, "recipient_id");
  if (recipientId && recipientId !== deliveryUserId) {
    return true;
  }
  return false;
}

async function loadPendingRows(
  admin: SupabaseClient,
  scope: AuthScope,
  body: { outbox_id?: string; limit?: number },
): Promise<{ rows: OutboxRow[]; error: string | null }> {
  if (typeof body.outbox_id === "string" && body.outbox_id.length > 0) {
    let query = admin
      .from("push_outbox")
      .select("id, user_id, title, body, data")
      .eq("id", body.outbox_id)
      .is("delivered_at", null)
      .limit(1);
    if (scope.mode === "user") {
      query = query.eq("user_id", scope.userId);
    }
    const { data, error } = await query;
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []) as OutboxRow[], error: null };
  }

  const limit = Math.min(Math.max(Number(body.limit) || 50, 1), scope.mode === "user" ? 50 : 200);
  let query = admin
    .from("push_outbox")
    .select("id, user_id, title, body, data")
    .is("delivered_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (scope.mode === "user") {
    query = query.eq("user_id", scope.userId);
  }
  const { data, error } = await query;
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as OutboxRow[], error: null };
}

Deno.serve(async (req) => {
  console.log("[consume-push-outbox] request", req.method);
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

  const scope = await resolveAuthScope(req, url, serviceKey);
  if (!scope) {
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
  const { rows: loadedRows, error: loadError } = await loadPendingRows(admin, scope, body);
  if (loadError) {
    return new Response(JSON.stringify({ error: loadError }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rows =
    scope.mode === "user"
      ? loadedRows.filter((row) => resolveDeliveryUserId(row) === scope.userId)
      : loadedRows;

  const now = new Date().toISOString();
  const expoMessages: ExpoPushMessage[] = [];
  const rowIdsToMark: string[] = [];
  const skippedNoToken: string[] = [];
  const skippedActorSelf: string[] = [];

  for (const row of rows) {
    if (isPushForActor(row)) {
      skippedActorSelf.push(row.id);
      continue;
    }
    const deliveryUserId = resolveDeliveryUserId(row);
    const { data: tokens, error: tokErr } = await admin
      .from("user_push_tokens")
      .select("expo_push_token")
      .eq("user_id", deliveryUserId)
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
        sound: "default",
        priority: "high",
        channelId: ANDROID_PUSH_CHANNEL_ID,
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

  const deliveredIds = [...rowIdsToMark, ...skippedActorSelf];
  if (deliveredIds.length > 0) {
    await admin.from("push_outbox").update({ delivered_at: now }).in("id", deliveredIds);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      auth_mode: scope.mode,
      processed_rows: rows.length,
      expo_messages: expoMessages.length,
      marked_delivered_ids: rowIdsToMark,
      skipped_no_expo_token_ids: skippedNoToken,
      skipped_actor_self_ids: skippedActorSelf,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
