import { supabase } from "@/integrations/supabase/client";
import { env } from "@/lib/env";

type CheckoutBody = Record<string, unknown>;

async function createLemonCheckout(body: CheckoutBody): Promise<string> {
  const postOnce = async (): Promise<{ url?: string; unauthorized?: boolean; message?: string }> => {
    let { data: sessionData } = await supabase.auth.getSession();
    let token = sessionData.session?.access_token;
    if (!token) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      token = refreshed.session?.access_token;
    }
    const res = await fetch(env.lemonCreateCheckoutUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (res.status === 401) return { unauthorized: true };
    if (!res.ok) return { message: json.error ?? `HTTP ${res.status}` };
    if (!json.url?.startsWith("https://")) return { message: "Invalid checkout URL" };
    return { url: json.url };
  };

  let out = await postOnce();
  if (out.unauthorized) {
    await supabase.auth.refreshSession();
    out = await postOnce();
  }
  if (out.url) return out.url;
  throw new Error(out.message ?? "Checkout failed");
}

/**
 * Lemon Squeezy hosted checkout for the current user's shopping cart.
 */
export async function createLemonShoppingCheckout(): Promise<string> {
  return createLemonCheckout({});
}

/**
 * Lemon Squeezy checkout for a single service cart line; redirect returns with `next=bookings`.
 */
export async function createLemonServiceBookingCheckout(cartItemId: string): Promise<string> {
  return createLemonCheckout({ cart_item_id: cartItemId });
}
