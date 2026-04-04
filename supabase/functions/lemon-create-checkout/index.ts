import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const LS_API = "https://api.lemonsqueezy.com/v1/checkouts";

type CartRow = {
  quantity: number;
  shopping_item: { price: number } | null;
};

/** PostgREST / client types may embed FK as object or array; normalize for totals. */
type CartQueryRow = {
  quantity: number;
  shopping_item: { price: number } | { price: number }[] | null;
};

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

/** Map app cart total → Lemon custom_price (minor units). Default *100 for cent-based currencies. */
function toCustomPriceMinorUnits(total: number): number {
  const mult = Number(Deno.env.get("LEMONSQUEEZY_PRICE_MINOR_MULT") ?? "100");
  const n = Math.round(total * mult);
  return Math.max(1, n);
}

function withNextParam(url: string, next: string | undefined): string {
  if (!next) return url;
  const u = new URL(url);
  u.searchParams.set("next", next);
  return u.toString();
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

    const apiKey = Deno.env.get("LEMONSQUEEZY_API_KEY");
    const storeId = Deno.env.get("LEMONSQUEEZY_STORE_ID");
    const variantId = Deno.env.get("LEMONSQUEEZY_VARIANT_ID");
    const redirectUrl = Deno.env.get("LEMONSQUEEZY_REDIRECT_URL") ?? "https://pixapp.kz/cart/payment-success";

    if (!apiKey || !storeId || !variantId) {
      console.error("[lemon-create-checkout] Missing LEMONSQUEEZY_API_KEY, STORE_ID, or VARIANT_ID");
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: auth } } },
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    let rawJson = "";
    try {
      rawJson = await req.text();
    } catch {
      rawJson = "";
    }
    let postBody: { cart_item_id?: string } = {};
    if (rawJson.trim()) {
      try {
        postBody = JSON.parse(rawJson) as { cart_item_id?: string };
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const redirectBase = redirectUrl;

    let customPrice: number;
    let checkoutCustom: Record<string, string>;
    let finalRedirectUrl: string;

    if (typeof postBody.cart_item_id === "string" && postBody.cart_item_id.length > 0) {
      const { data: svcRow, error: svcErr } = await supabase
        .from("cart_items")
        .select(
          "id, user_id, status, business_card_id, date_time, cost, persons, customer_name, customer_phone, customer_email, comment",
        )
        .eq("id", postBody.cart_item_id)
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

      const total = Number(svcRow.cost);
      if (!Number.isFinite(total) || total <= 0) {
        return new Response(JSON.stringify({ error: "Invalid booking price" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      customPrice = toCustomPriceMinorUnits(total);
      checkoutCustom = {
        user_id: userId,
        checkout_type: "service_booking",
        cart_item_id: String(svcRow.id),
      };
      finalRedirectUrl = withNextParam(redirectBase, "bookings");
    } else {
      const { data: rows, error: cartErr } = await supabase
        .from("shopping_cart_items")
        .select("quantity, shopping_item:shopping_items(price)")
        .eq("user_id", userId);

      if (cartErr) throw cartErr;

      const list = normalizeCartRows(rows ?? []);
      if (list.length === 0) {
        return new Response(JSON.stringify({ error: "Cart is empty" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const total = sumShoppingTotal(list);
      if (total <= 0) {
        return new Response(JSON.stringify({ error: "Invalid cart total" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      customPrice = toCustomPriceMinorUnits(total);
      checkoutCustom = {
        user_id: userId,
        checkout_type: "shopping_cart",
      };
      finalRedirectUrl = redirectBase;
    }

    const testMode = (Deno.env.get("LEMONSQUEEZY_TEST_MODE") ?? "false").toLowerCase() === "true";
    const variantNum = Number(variantId);
    const enabledVariants = Number.isFinite(variantNum) ? [variantNum] : [];

    const body = {
      data: {
        type: "checkouts",
        attributes: {
          custom_price: customPrice,
          test_mode: testMode,
          product_options: {
            redirect_url: finalRedirectUrl,
            ...(enabledVariants.length > 0 ? { enabled_variants: enabledVariants } : {}),
          },
          checkout_data: {
            custom: checkoutCustom,
          },
        },
        relationships: {
          store: { data: { type: "stores", id: String(storeId) } },
          variant: { data: { type: "variants", id: String(variantId) } },
        },
      },
    };

    const lsRes = await fetch(LS_API, {
      method: "POST",
      headers: {
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const lsText = await lsRes.text();
    if (!lsRes.ok) {
      console.error("[lemon-create-checkout] Lemon API error:", lsRes.status, lsText.slice(0, 500));
      return new Response(JSON.stringify({ error: "Could not start checkout", detail: lsText.slice(0, 200) }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lsJson = JSON.parse(lsText) as {
      data?: { attributes?: { url?: string } };
    };
    const url = lsJson?.data?.attributes?.url;
    if (!url || !url.startsWith("https://")) {
      return new Response(JSON.stringify({ error: "Invalid checkout URL from Lemon Squeezy" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[lemon-create-checkout]", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
