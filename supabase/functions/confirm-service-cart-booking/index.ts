import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type ReqBody = { cart_item_id?: string };

function jsonHeaders() {
  return { ...corsHeaders, "Content-Type": "application/json" };
}

/** Parse a price like "$25" or "25 USD" into a number; returns null if not usable. */
function parsePriceToNumber(raw: string | null | undefined): number | null {
  if (raw == null || !String(raw).trim()) return null;
  const m = String(raw).replace(/,/g, "").match(/(\d+(\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
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

  if (!url || !anonKey || !serviceKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: jsonHeaders(),
    });
  }

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
      "id, user_id, status, business_card_id, date_time, cost, persons, customer_name, customer_phone, customer_email, comment, wa_confirmable, wa_confirmed_price",
    )
    .eq("id", cartItemId)
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchErr) {
    console.error("[confirm-service-cart-booking] fetch", fetchErr);
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500,
      headers: jsonHeaders(),
    });
  }
  if (!row || row.status !== "created") {
    return new Response(JSON.stringify({ error: "Cart item not found" }), {
      status: 404,
      headers: jsonHeaders(),
    });
  }
  if (!row.wa_confirmable) {
    return new Response(JSON.stringify({ error: "Booking is not confirmable yet" }), {
      status: 409,
      headers: jsonHeaders(),
    });
  }

  const parsed = parsePriceToNumber(row.wa_confirmed_price as string | null);
  const cost = parsed != null ? parsed : Number(row.cost);

  const { data: inserted, error: bookErr } = await db
    .from("bookings")
    .insert({
      user_id: userId,
      business_card_id: row.business_card_id,
      date_time: row.date_time,
      cost,
      persons: row.persons,
      customer_name: row.customer_name,
      customer_phone: row.customer_phone,
      customer_email: row.customer_email,
      comment: row.comment,
      status: "upcoming",
      payment_status: "paid",
    })
    .select("id")
    .maybeSingle();

  if (bookErr) {
    console.error("[confirm-service-cart-booking] insert booking", bookErr);
    return new Response(JSON.stringify({ error: bookErr.message }), {
      status: 500,
      headers: jsonHeaders(),
    });
  }

  const paidAt = new Date().toISOString();
  const { error: paidErr } = await db
    .from("cart_items")
    .update({ status: "paid", paid_at: paidAt })
    .eq("id", row.id)
    .eq("user_id", userId)
    .eq("status", "created");

  if (paidErr) {
    console.error("[confirm-service-cart-booking] cart update", paidErr);
    return new Response(JSON.stringify({ error: paidErr.message }), {
      status: 500,
      headers: jsonHeaders(),
    });
  }

  return new Response(
    JSON.stringify({ ok: true, booking_id: inserted?.id ?? null }),
    { status: 200, headers: jsonHeaders() },
  );
});
