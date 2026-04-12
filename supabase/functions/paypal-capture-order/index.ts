import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type CaptureReq = { orderId?: string };

type PaypalAccessTokenRes = {
  access_token?: string;
};

type PaypalCaptureOrderRes = {
  status?: string;
  purchase_units?: Array<{
    custom_id?: string;
  }>;
  details?: Array<{
    issue?: string;
    description?: string;
  }>;
  message?: string;
};

function extractCustomIdFromOrder(order: PaypalCaptureOrderRes): string | undefined {
  const units = order.purchase_units;
  if (!Array.isArray(units)) return undefined;
  for (const u of units) {
    const raw = u?.custom_id;
    if (typeof raw === "string") {
      const t = raw.trim();
      if (t.length > 0) return t;
    }
  }
  return undefined;
}

function normalizeUserId(id: string): string {
  return id.trim().toLowerCase();
}

function hasIssue(payload: PaypalCaptureOrderRes, issue: string): boolean {
  return payload.details?.some((d) => d.issue === issue) === true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function getPaypalBaseUrl(): string {
  const mode = (Deno.env.get("PAYPAL_ENV") ?? "sandbox").trim().toLowerCase();
  if (mode === "live") return "https://api-m.paypal.com";
  return "https://api-m.sandbox.paypal.com";
}

async function getPaypalAccessToken(): Promise<string> {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const clientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET");
  }

  // Keep OAuth request equivalent to the documented curl call:
  // POST /v1/oauth2/token, Basic auth, x-www-form-urlencoded grant_type=client_credentials.
  const basic = btoa(`${clientId}:${clientSecret}`);
  const oauthBody = new URLSearchParams({ grant_type: "client_credentials" }).toString();
  const base = getPaypalBaseUrl();
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: oauthBody,
  });
  const json = (await res.json().catch(() => ({}))) as PaypalAccessTokenRes & { error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description ?? `PayPal auth failed (HTTP ${res.status})`);
  }
  return json.access_token;
}

async function paypalFetchJson<T>(url: string, init: RequestInit, timeoutMs = 9000): Promise<{ res: Response; json: T }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("timeout"), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const json = (await res.json().catch(() => ({}))) as T;
    return { res, json };
  } finally {
    clearTimeout(timeout);
  }
}

function parseCustomId(raw: string | undefined): {
  checkoutType: "shopping_cart" | "service_booking";
  userId: string;
  cartItemId?: string;
} | null {
  if (!raw) return null;
  const s = raw.trim();
  // Prefix + slice so UUIDs / future formats are not broken by split(":").
  if (s.startsWith("shopping_cart:")) {
    const userId = s.slice("shopping_cart:".length).trim();
    return userId ? { checkoutType: "shopping_cart", userId } : null;
  }
  if (s.startsWith("service_booking:")) {
    const rest = s.slice("service_booking:".length).trim();
    const idx = rest.indexOf(":");
    if (idx === -1) return null;
    const userId = rest.slice(0, idx).trim();
    const cartItemId = rest.slice(idx + 1).trim();
    return userId && cartItemId ? { checkoutType: "service_booking", userId, cartItemId } : null;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as CaptureReq;
    const orderId = body.orderId?.trim();
    if (!orderId) {
      return new Response(JSON.stringify({ error: "Missing orderId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getPaypalAccessToken();
    const base = getPaypalBaseUrl();

    const maxAttempts = 3;
    const retryDelayMs = 900;
    let captureJson: PaypalCaptureOrderRes = {};

    const getOrder = async () => {
      const { res, json } = await paypalFetchJson<PaypalCaptureOrderRes>(
        `${base}/v2/checkout/orders/${encodeURIComponent(orderId)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        },
      );
      return { res, json };
    };

    // If redirect returned slowly, order may already be captured.
    const initialOrder = await getOrder();
    if (initialOrder.res.ok && initialOrder.json.status === "COMPLETED") {
      captureJson = initialOrder.json;
    }

    for (let attempt = 1; attempt <= maxAttempts && captureJson.status !== "COMPLETED"; attempt += 1) {
      const { res: captureRes, json } = await paypalFetchJson<PaypalCaptureOrderRes>(
        `${base}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        },
      );
      captureJson = json;
      const captureMessage = captureJson.message;
      const captureIssues = captureJson.details ?? [];
      console.log("[paypal-capture-order] capture attempt", {
        attempt,
        httpStatus: captureRes.status,
        paypalStatus: captureJson.status ?? null,
        issues: captureIssues.map((d) => d.issue).filter(Boolean),
      });

      if (captureRes.ok && captureJson.status === "COMPLETED") {
        break;
      }

      // Declined by issuer — retrying capture on the same order does not help.
      if (!captureRes.ok && hasIssue(captureJson, "INSTRUMENT_DECLINED")) {
        return new Response(
          JSON.stringify({
            status: "FAILED",
            error: "Your payment was declined. Try another card or payment method.",
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // If capture says already captured, trust order status endpoint.
      const isAlreadyCaptured = hasIssue(captureJson, "ORDER_ALREADY_CAPTURED");
      const { res: orderRes, json: orderJson } = await getOrder();
      console.log("[paypal-capture-order] order status", {
        attempt,
        httpStatus: orderRes.status,
        paypalStatus: orderJson.status ?? null,
      });
      if (!orderRes.ok) {
        const message = captureMessage ?? orderJson.message ?? `PayPal capture failed (HTTP ${captureRes.status})`;
        return new Response(JSON.stringify({ status: "FAILED", error: message }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      captureJson = orderJson;
      if (captureJson.status === "COMPLETED") {
        break;
      }
      if (!captureRes.ok && !isAlreadyCaptured) {
        const issueSet = new Set(captureIssues.map((d) => d.issue).filter(Boolean));
        // PAYER_ACTION_REQUIRED may clear after a short delay; do not retry INSTRUMENT_DECLINED (handled above).
        const retriable422 = captureRes.status === 422 && issueSet.has("PAYER_ACTION_REQUIRED");
        const orderStillInProgress =
          captureJson.status === "APPROVED" || captureJson.status === "PAYER_ACTION_REQUIRED";
        if (retriable422 || orderStillInProgress) {
          if (attempt < maxAttempts) {
            await sleep(retryDelayMs);
            continue;
          }
          break;
        }
        const message = captureMessage ?? `PayPal capture failed (HTTP ${captureRes.status})`;
        return new Response(JSON.stringify({ status: "FAILED", error: message }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (attempt < maxAttempts) {
        await sleep(retryDelayMs);
      }
    }

    if (captureJson.status !== "COMPLETED") {
      // APPROVED after retries means capture never completed — not "still processing".
      if (captureJson.status === "APPROVED" || captureJson.status === "PAYER_ACTION_REQUIRED") {
        return new Response(
          JSON.stringify({
            status: "FAILED",
            error:
              "Payment was not completed. Start checkout again, or use another payment method if your card was declined.",
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ status: "PENDING", paypalStatus: captureJson.status ?? "UNKNOWN" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Capture response sometimes omits purchase_units.custom_id; GET order usually includes it.
    let orderForMeta = captureJson;
    if (!extractCustomIdFromOrder(orderForMeta)) {
      const refreshed = await getOrder();
      if (refreshed.res.ok && extractCustomIdFromOrder(refreshed.json)) {
        orderForMeta = refreshed.json;
      }
    }
    const customIdRaw = extractCustomIdFromOrder(orderForMeta);
    const meta = parseCustomId(customIdRaw);
    if (!meta) {
      console.warn("[paypal-capture-order] missing custom_id after capture", {
        orderId,
        hasUnits: Boolean(orderForMeta.purchase_units?.length),
      });
      return new Response(
        JSON.stringify({
          status: "FAILED",
          error:
            "Payment metadata is missing from PayPal. Try again, or contact support if this keeps happening.",
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (normalizeUserId(meta.userId) !== normalizeUserId(userData.user.id)) {
      console.warn("[paypal-capture-order] custom_id user mismatch", {
        orderId,
        checkoutType: meta.checkoutType,
      });
      return new Response(JSON.stringify({ status: "FAILED", error: "Order does not belong to user" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const db =
      serviceKey && serviceKey.length > 0
        ? createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey, { auth: { persistSession: false } })
        : userClient;

    if (meta.checkoutType === "shopping_cart") {
      const paidAt = new Date().toISOString();
      const { error: updErr } = await db
        .from("shopping_cart_items")
        .update({ status: "paid", paid_at: paidAt })
        .eq("user_id", meta.userId)
        .eq("status", "created");
      if (updErr) throw updErr;
      return new Response(JSON.stringify({ status: "COMPLETED" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cartItemId = meta.cartItemId;
    if (!cartItemId) {
      return new Response(JSON.stringify({ status: "FAILED", error: "Missing cart_item_id in order metadata" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: row, error: fetchErr } = await db
      .from("cart_items")
      .select("id, business_card_id, date_time, cost, persons, customer_name, customer_phone, customer_email, comment, status")
      .eq("id", cartItemId)
      .eq("user_id", meta.userId)
      .maybeSingle();
    if (fetchErr) throw fetchErr;

    if (!row) {
      return new Response(JSON.stringify({ status: "COMPLETED", bookingNext: "bookings" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (row.status === "paid") {
      return new Response(JSON.stringify({ status: "COMPLETED", bookingNext: "bookings" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (row.status !== "created") {
      return new Response(JSON.stringify({ status: "COMPLETED", bookingNext: "bookings" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceRow = row as ServiceCartRow;
    const { data: insertedBookings, error: bookErr } = await db
      .from("bookings")
      .insert({
        user_id: meta.userId,
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
    if (bookErr) throw bookErr;

    let bookingId = insertedBookings?.[0]?.id;
    if (!bookingId) {
      const { data: found } = await db
        .from("bookings")
        .select("id")
        .eq("user_id", meta.userId)
        .eq("business_card_id", serviceRow.business_card_id)
        .eq("date_time", serviceRow.date_time)
        .eq("payment_status", "pending")
        .order("created_at", { ascending: false })
        .limit(1);
      bookingId = found?.[0]?.id;
    }
    if (bookingId) {
      const { error: paidBookingErr } = await db
        .from("bookings")
        .update({ payment_status: "paid" })
        .eq("id", bookingId);
      if (paidBookingErr) throw paidBookingErr;
    }

    const paidAt = new Date().toISOString();
    const { error: paidErr } = await db
      .from("cart_items")
      .update({ status: "paid", paid_at: paidAt })
      .eq("id", serviceRow.id)
      .eq("user_id", meta.userId);
    if (paidErr) throw paidErr;

    return new Response(JSON.stringify({ status: "COMPLETED", bookingNext: "bookings" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[paypal-capture-order]", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
