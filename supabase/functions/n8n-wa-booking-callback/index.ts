import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type Body = {
  callback_token?: string;
  status_lines?: unknown;
  confirmable?: boolean;
  confirmed_slot?: string | null;
  confirmed_price?: string | null;
};

function jsonHeaders() {
  return { ...corsHeaders, "Content-Type": "application/json" };
}

function normalizeStatusLines(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") return null;
    out.push(x);
  }
  return out;
}

function bearerToken(req: Request): string | null {
  const h = req.headers.get("Authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1].trim() : null;
}

/**
 * Shared secret for server → this function.
 * Prefer **`x-wa-booking-secret`** so **`Authorization`** can carry the Supabase **anon JWT**
 * (`Bearer <SUPABASE_ANON_KEY>`), which the hosted API gateway requires. Putting the inbound
 * secret in `Authorization` alone fails with `UNAUTHORIZED_INVALID_JWT_FORMAT` because it is not a JWT.
 */
function callbackSharedSecret(req: Request): string | null {
  const fromDedicated =
    req.headers.get("x-wa-booking-secret") ?? req.headers.get("X-Wa-Booking-Secret") ?? "";
  const t = fromDedicated.trim();
  if (t) return t;
  return bearerToken(req);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders(),
    });
  }

  const secretRaw = Deno.env.get("N8N_INBOUND_SECRET");
  const secret = secretRaw?.trim() ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");

  if (!serviceKey || !supabaseUrl) {
    console.error("[n8n-wa-booking-callback] Missing Supabase service env");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: jsonHeaders(),
    });
  }

  if (secret.length > 0) {
    const token = callbackSharedSecret(req);
    if (!token || token !== secret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: jsonHeaders(),
      });
    }
  } else {
    console.warn("[n8n-wa-booking-callback] N8N_INBOUND_SECRET unset — callback is open (set secret for production)");
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: jsonHeaders(),
    });
  }

  const callbackToken = typeof body.callback_token === "string" ? body.callback_token.trim() : "";
  if (!callbackToken) {
    return new Response(JSON.stringify({ error: "Missing callback_token" }), {
      status: 400,
      headers: jsonHeaders(),
    });
  }

  const lines = normalizeStatusLines(body.status_lines);
  if (lines === null) {
    return new Response(JSON.stringify({ error: "status_lines must be a JSON array of strings" }), {
      status: 400,
      headers: jsonHeaders(),
    });
  }

  const confirmable = Boolean(body.confirmable);
  const slot = body.confirmed_slot != null ? String(body.confirmed_slot).trim() || null : null;
  const price = body.confirmed_price != null ? String(body.confirmed_price).trim() || null : null;

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: row, error: selErr } = await db
    .from("cart_items")
    .select("id, status, wa_n8n_callback_token")
    .eq("wa_n8n_callback_token", callbackToken)
    .eq("status", "created")
    .maybeSingle();

  if (selErr) {
    console.error("[n8n-wa-booking-callback] select", selErr);
    return new Response(JSON.stringify({ error: selErr.message }), {
      status: 500,
      headers: jsonHeaders(),
    });
  }
  if (!row) {
    return new Response(JSON.stringify({ error: "Unknown or inactive cart item" }), {
      status: 404,
      headers: jsonHeaders(),
    });
  }

  const patch: Record<string, unknown> = {
    wa_status_lines: lines,
    wa_confirmable: confirmable,
  };
  if (slot !== null) patch.wa_confirmed_slot = slot;
  if (price !== null) patch.wa_confirmed_price = price;

  const { error: updErr } = await db.from("cart_items").update(patch).eq("id", row.id);
  if (updErr) {
    console.error("[n8n-wa-booking-callback] update", updErr);
    return new Response(JSON.stringify({ error: updErr.message }), {
      status: 500,
      headers: jsonHeaders(),
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: jsonHeaders(),
  });
});
