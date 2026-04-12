import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type CreateOrderReq = {
  cart_item_id?: string;
  return_url?: string;
  cancel_url?: string;
};

type CartQueryRow = {
  quantity: number;
  shopping_item: { price: number } | { price: number }[] | null;
};

type CartRow = {
  quantity: number;
  shopping_item: { price: number } | null;
};

type PaypalAccessTokenRes = {
  access_token?: string;
};

type PaypalCreateOrderRes = {
  id?: string;
  links?: Array<{ rel?: string; href?: string }>;
};

function getPaypalBaseUrl(): string {
  const mode = (Deno.env.get("PAYPAL_ENV") ?? "sandbox").trim().toLowerCase();
  if (mode === "live") return "https://api-m.paypal.com";
  return "https://api-m.sandbox.paypal.com";
}

function moneyFromTotal(total: number): string {
  const minorMult = Number(Deno.env.get("PAYPAL_PRICE_MINOR_MULT") ?? "100");
  const safeMult = Number.isFinite(minorMult) && minorMult > 0 ? minorMult : 100;
  const minor = Math.max(1, Math.round(total * safeMult));

  if (safeMult === 1) return String(minor);

  let decimals = 0;
  let x = safeMult;
  while (x > 1 && x % 10 === 0) {
    decimals += 1;
    x = x / 10;
  }
  const major = minor / safeMult;
  return major.toFixed(decimals);
}

function normalizeCartRows(rows: CartQueryRow[]): CartRow[] {
  return rows.map((row) => {
    const si = row.shopping_item;
    const shopping_item =
      si == null ? null : Array.isArray(si) ? (si[0] ?? null) : si;
    return { quantity: row.quantity, shopping_item };
  });
}

function sumShoppingTotal(rows: CartRow[]): number {
  let total = 0;
  for (const row of rows) {
    const p = row.shopping_item?.price ?? 0;
    total += p * row.quantity;
  }
  return total;
}

function appendNextParam(urlStr: string, next?: string): string {
  if (!next) return urlStr;
  const u = new URL(urlStr);
  u.searchParams.set("next", next);
  return u.toString();
}

function isAllowedCallbackUrl(urlStr: string | undefined): urlStr is string {
  if (!urlStr) return false;
  try {
    const u = new URL(urlStr);
    return u.protocol === "https:" || u.protocol === "exp:" || u.protocol === "exps:" || u.protocol === "pixap:";
  } catch {
    return false;
  }
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

    let rawJson = "";
    try {
      rawJson = await req.text();
    } catch {
      rawJson = "";
    }
    let body: CreateOrderReq = {};
    if (rawJson.trim()) {
      try {
        body = JSON.parse(rawJson) as CreateOrderReq;
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const userId = userData.user.id;
    const currencyCode = (Deno.env.get("PAYPAL_CURRENCY_CODE") ?? "USD").toUpperCase();
    const envReturnUrl = Deno.env.get("PAYPAL_RETURN_URL");
    const envCancelUrl = Deno.env.get("PAYPAL_CANCEL_URL");
    if (!envReturnUrl || !envCancelUrl) {
      throw new Error("Missing PAYPAL_RETURN_URL or PAYPAL_CANCEL_URL");
    }
    const returnUrlBase = isAllowedCallbackUrl(body.return_url) ? body.return_url : envReturnUrl;
    const cancelUrl = isAllowedCallbackUrl(body.cancel_url) ? body.cancel_url : envCancelUrl;

    let total = 0;
    let checkoutType: "shopping_cart" | "service_booking";
    let cartItemId: string | undefined;
    let returnUrl = returnUrlBase;

    if (typeof body.cart_item_id === "string" && body.cart_item_id.length > 0) {
      const { data: svcRow, error: svcErr } = await userClient
        .from("cart_items")
        .select("id, cost, status")
        .eq("id", body.cart_item_id)
        .eq("user_id", userId)
        .eq("status", "created")
        .maybeSingle();
      if (svcErr) throw svcErr;
      if (!svcRow) {
        return new Response(JSON.stringify({ error: "Cart item not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      total = Number(svcRow.cost);
      if (!Number.isFinite(total) || total <= 0) {
        return new Response(JSON.stringify({ error: "Invalid booking price" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      checkoutType = "service_booking";
      cartItemId = String(svcRow.id);
      returnUrl = appendNextParam(returnUrlBase, "bookings");
    } else {
      const { data: rows, error: cartErr } = await userClient
        .from("shopping_cart_items")
        .select("quantity, shopping_item:shopping_items(price)")
        .eq("user_id", userId)
        .eq("status", "created");
      if (cartErr) throw cartErr;
      const list = normalizeCartRows(rows ?? []);
      if (list.length === 0) {
        return new Response(JSON.stringify({ error: "Cart is empty" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      total = sumShoppingTotal(list);
      if (total <= 0) {
        return new Response(JSON.stringify({ error: "Invalid cart total" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      checkoutType = "shopping_cart";
    }

    const customId = checkoutType === "service_booking"
      ? `service_booking:${userId}:${cartItemId}`
      : `shopping_cart:${userId}`;
    const amountValue = moneyFromTotal(total);
    const accessToken = await getPaypalAccessToken();
    const base = getPaypalBaseUrl();

    const orderRes = await fetch(`${base}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: { currency_code: currencyCode, value: amountValue },
            custom_id: customId,
          },
        ],
        application_context: {
          return_url: returnUrl,
          cancel_url: cancelUrl,
          user_action: "PAY_NOW",
        },
      }),
    });
    const orderJson = (await orderRes.json().catch(() => ({}))) as PaypalCreateOrderRes & { message?: string };
    if (!orderRes.ok || !orderJson.id) {
      const msg = orderJson.message ?? `PayPal order creation failed (HTTP ${orderRes.status})`;
      return new Response(JSON.stringify({ error: msg }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const approveUrl = orderJson.links?.find((l) => l.rel === "approve")?.href;
    if (!approveUrl?.startsWith("https://")) {
      return new Response(JSON.stringify({ error: "PayPal approve URL missing" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ orderId: orderJson.id, approveUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[paypal-create-order]", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
