import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  const bytes = new Uint8Array(sig);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

type WebhookPayload = {
  meta?: {
    event_name?: string;
    custom_data?: Record<string, unknown>;
  };
  data?: {
    type?: string;
    id?: string;
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 204 });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const secret = Deno.env.get("LEMONSQUEEZY_SIGNING_SECRET");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");

  if (!secret || !serviceKey || !supabaseUrl) {
    console.error("[lemon-webhook] Missing LEMONSQUEEZY_SIGNING_SECRET or Supabase service env");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), { status: 500 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("X-Signature") ?? "";
  const eventName = req.headers.get("X-Event-Name") ?? "";

  const expected = await hmacSha256Hex(secret, rawBody);
  if (!timingSafeEqualHex(expected, signature)) {
    console.warn("[lemon-webhook] Invalid signature");
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  if (eventName !== "order_created" && payload.meta?.event_name !== "order_created") {
    return new Response(JSON.stringify({ ok: true, ignored: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const custom = payload.meta?.custom_data ?? {};
  const checkoutType = typeof custom.checkout_type === "string" ? custom.checkout_type : "";
  const userIdRaw = custom.user_id;
  const userId = typeof userIdRaw === "string" ? userIdRaw : null;

  if (!userId || (checkoutType !== "shopping_cart" && checkoutType !== "service_booking")) {
    return new Response(JSON.stringify({ ok: true, skipped: "unknown checkout_type or missing user" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const orderId = payload.data?.id;
  if (!orderId) {
    return new Response(JSON.stringify({ error: "Missing order id" }), { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  type ServiceCartRow = {
    id: string;
    business_card_id: string;
    date_time: string;
    cost: number;
    persons: number | null;
    customer_name: string | null;
    customer_phone: string | null;
    customer_email: string | null;
    comment: string | null;
  };
  let serviceRow: ServiceCartRow | null = null;

  if (checkoutType === "service_booking") {
    const cartItemIdRaw = custom.cart_item_id;
    const cartItemId = typeof cartItemIdRaw === "string" ? cartItemIdRaw : null;
    if (!cartItemId) {
      console.error("[lemon-webhook] service_booking missing cart_item_id");
      return new Response(JSON.stringify({ error: "Missing cart_item_id" }), { status: 500 });
    }

    const { data: row, error: fetchErr } = await admin
      .from("cart_items")
      .select(
        "id, business_card_id, date_time, cost, persons, customer_name, customer_phone, customer_email, comment",
      )
      .eq("id", cartItemId)
      .eq("user_id", userId)
      .eq("status", "created")
      .maybeSingle();

    if (fetchErr) {
      console.error("[lemon-webhook] load cart_items:", fetchErr);
      return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 });
    }
    if (!row) {
      console.error("[lemon-webhook] cart item not found for paid order:", cartItemId);
      return new Response(JSON.stringify({ error: "Cart item not found" }), { status: 500 });
    }
    serviceRow = row as ServiceCartRow;
  }

  const { error: insErr } = await admin.from("processed_lemon_orders").insert({
    lemon_order_id: String(orderId),
    user_id: userId,
    checkout_type: checkoutType,
  });

  if (insErr) {
    if (insErr.code === "23505") {
      return new Response(JSON.stringify({ ok: true, duplicate: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.error("[lemon-webhook] insert processed_lemon_orders:", insErr);
    return new Response(JSON.stringify({ error: insErr.message }), { status: 500 });
  }

  if (checkoutType === "shopping_cart") {
    const { error: updErr } = await admin
      .from("shopping_cart_items")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("status", "created");
    if (updErr) {
      console.error("[lemon-webhook] mark shopping cart paid:", updErr);
      return new Response(JSON.stringify({ error: updErr.message }), { status: 500 });
    }
  } else if (serviceRow) {
    const { data: insertedBookings, error: bookErr } = await admin
      .from("bookings")
      .insert({
        user_id: userId,
        business_card_id: serviceRow.business_card_id,
        date_time: serviceRow.date_time,
        cost: serviceRow.cost,
        persons: serviceRow.persons,
        customer_name: serviceRow.customer_name,
        customer_phone: serviceRow.customer_phone,
        customer_email: serviceRow.customer_email,
        comment: serviceRow.comment,
        status: "upcoming",
        payment_status: "paid",
      })
      .select("id");

    if (bookErr) {
      console.error("[lemon-webhook] insert booking:", bookErr);
      return new Response(JSON.stringify({ error: bookErr.message }), { status: 500 });
    }

    let bookingId = insertedBookings?.[0]?.id;
    if (!bookingId) {
      const { data: found } = await admin
        .from("bookings")
        .select("id")
        .eq("user_id", userId)
        .eq("business_card_id", serviceRow.business_card_id)
        .eq("date_time", serviceRow.date_time)
        .eq("payment_status", "pending")
        .order("created_at", { ascending: false })
        .limit(1);
      bookingId = found?.[0]?.id;
    }
    if (bookingId) {
      const { error: paidBookingErr } = await admin
        .from("bookings")
        .update({ payment_status: "paid" })
        .eq("id", bookingId);
      if (paidBookingErr) {
        console.error("[lemon-webhook] set booking payment_status:", paidBookingErr);
        return new Response(JSON.stringify({ error: paidBookingErr.message }), { status: 500 });
      }
    }

    const { error: paidErr } = await admin
      .from("cart_items")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", serviceRow.id)
      .eq("user_id", userId);
    if (paidErr) {
      console.error("[lemon-webhook] update cart_items paid:", paidErr);
      return new Response(JSON.stringify({ error: paidErr.message }), { status: 500 });
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
