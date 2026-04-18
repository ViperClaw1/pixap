import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type ReqBody = { cart_item_id?: string };

function jsonHeaders() {
  return { ...corsHeaders, "Content-Type": "application/json" };
}

/** Split cart `date_time` into stable date/time strings for the WA booking service. */
function isoToDateAndTime(iso: string | null | undefined): { date: string; time: string } {
  if (!iso || typeof iso !== "string") return { date: "—", time: "—" };
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return { date: iso.trim() || "—", time: "" };
  const date = dt.toISOString().slice(0, 10);
  const time = dt.toISOString().slice(11, 16);
  return { date, time };
}

/** Base URL of `wa-booking-service`; may include or omit `/webhook/booking`. */
function resolveWaBookingServiceUrl(raw: string): string {
  const trimmed = raw.replace(/\/$/, "");
  if (/\/webhook\/booking$/i.test(trimmed)) return trimmed;
  return `${trimmed}/webhook/booking`;
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

  const auth =
    req.headers.get("Authorization") ??
    req.headers.get("authorization");
  if (!auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: jsonHeaders(),
    });
  }

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const waBookingBase = Deno.env.get("WA_BOOKING_SERVICE_URL")?.trim();

  if (!url || !anonKey || !serviceKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: jsonHeaders(),
    });
  }
  if (!waBookingBase) {
    return new Response(JSON.stringify({ error: "WA_BOOKING_SERVICE_URL is not set" }), {
      status: 500,
      headers: jsonHeaders(),
    });
  }
  const waBookingUrl = resolveWaBookingServiceUrl(waBookingBase);

  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: userData, error: authErr } = await userClient.auth.getUser();
  if (authErr || !userData.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: jsonHeaders(),
    });
  }
  const userId = userData.user.id;

  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: jsonHeaders(),
    });
  }

  const cartItemId = typeof body.cart_item_id === "string" ? body.cart_item_id.trim() : "";
  if (!cartItemId) {
    return new Response(JSON.stringify({ error: "Missing cart_item_id" }), {
      status: 400,
      headers: jsonHeaders(),
    });
  }

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: row, error: fetchErr } = await db
    .from("cart_items")
    .select(
      "id, user_id, status, business_card_id, date_time, cost, persons, customer_name, customer_phone, customer_email, comment, is_restaurant_table, wa_n8n_callback_token, wa_n8n_started_at, business_card:business_cards(name, contact_whatsapp)",
    )
    .eq("id", cartItemId)
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchErr) {
    console.error("[n8n-wa-booking-start] db_select", fetchErr.message, fetchErr);
    return new Response(
      JSON.stringify({
        error: fetchErr.message,
        step: "db_select",
        hint:
          "If this mentions a missing column, run the latest Supabase migrations (cart_items wa_* columns).",
      }),
      { status: 500, headers: jsonHeaders() },
    );
  }
  if (!row || row.status !== "created") {
    return new Response(JSON.stringify({ error: "Cart item not found" }), {
      status: 404,
      headers: jsonHeaders(),
    });
  }

  const bc = row.business_card as { name?: string | null; contact_whatsapp?: string | null } | null;
  const venueWhatsapp = (bc?.contact_whatsapp ?? "").trim();
  if (!venueWhatsapp) {
    return new Response(JSON.stringify({ error: "Venue has no contact_whatsapp" }), {
      status: 400,
      headers: jsonHeaders(),
    });
  }

  if (row.wa_n8n_started_at) {
    return new Response(
      JSON.stringify({
        ok: true,
        already_started: true,
        callback_token: row.wa_n8n_callback_token,
      }),
      { status: 200, headers: jsonHeaders() },
    );
  }

  let callbackToken = row.wa_n8n_callback_token as string | null;
  if (!callbackToken) {
    callbackToken = crypto.randomUUID();
    const { error: tokErr } = await db
      .from("cart_items")
      .update({ wa_n8n_callback_token: callbackToken })
      .eq("id", row.id)
      .eq("user_id", userId)
      .eq("status", "created")
      .is("wa_n8n_started_at", null);
    if (tokErr) {
      console.error("[n8n-wa-booking-start] token update", tokErr);
      return new Response(JSON.stringify({ error: tokErr.message }), {
        status: 500,
        headers: jsonHeaders(),
      });
    }
  }

  const callbackPath = `${url.replace(/\/$/, "")}/functions/v1/n8n-wa-booking-callback`;
  const { date, time } = isoToDateAndTime(row.date_time as string | null | undefined);

  const outbound = {
    booking_id: String(row.id),
    venue_name: bc?.name ?? "—",
    date,
    time,
    owner_phone: venueWhatsapp,
    user_id: userId,
    venue_id: row.business_card_id != null ? String(row.business_card_id) : null,
    supabase_callback_url: callbackPath,
    supabase_callback_token: callbackToken,
  };

  let waRes: Response;
  try {
    waRes = await fetch(waBookingUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(outbound),
    });
  } catch (e) {
    const reachError = e instanceof Error ? e.message : String(e);
    console.error("[n8n-wa-booking-start] fetch wa-booking-service", reachError, e);
    return new Response(
      JSON.stringify({
        error: "Failed to reach wa-booking-service",
        step: "wa_booking_fetch",
        reach_error: reachError,
        hint:
          "Supabase Edge runs in the cloud: WA_BOOKING_SERVICE_URL must be a public HTTPS URL (not localhost or a private LAN IP).",
      }),
      { status: 502, headers: jsonHeaders() },
    );
  }

  if (!waRes.ok) {
    const text = await waRes.text();
    const preview = text.slice(0, 400);
    console.warn("[n8n-wa-booking-start] wa_booking_upstream", waRes.status, preview);
    return new Response(
      JSON.stringify({
        error: "wa_booking_service_failed",
        step: "wa_booking_fetch",
        wa_booking_status: waRes.status,
        wa_booking_body_preview: preview || undefined,
        hint:
          waRes.status === 404
            ? "WA_BOOKING_SERVICE_URL may be wrong (expected base URL or full .../webhook/booking path)."
            : undefined,
      }),
      { status: 502, headers: jsonHeaders() },
    );
  }

  const startedAt = new Date().toISOString();
  const { error: doneErr } = await db
    .from("cart_items")
    .update({ wa_n8n_started_at: startedAt })
    .eq("id", row.id)
    .eq("user_id", userId)
    .eq("status", "created");

  if (doneErr) {
    console.error("[n8n-wa-booking-start] started_at update", doneErr);
    return new Response(JSON.stringify({ error: doneErr.message }), {
      status: 500,
      headers: jsonHeaders(),
    });
  }

  return new Response(
    JSON.stringify({ ok: true, callback_token: callbackToken, already_started: false }),
    { status: 200, headers: jsonHeaders() },
  );
});
