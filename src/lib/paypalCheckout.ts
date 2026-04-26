import { supabase } from "@/integrations/supabase/client";
import { env } from "@/lib/env";
import { safeRefreshSession } from "@/lib/supabaseAuth";
import * as Linking from "expo-linking";

type CheckoutBody = Record<string, unknown>;

type CreateOrderResponse = {
  orderId: string;
  approveUrl: string;
};

type CaptureOrderResponse = {
  status: "COMPLETED" | "PENDING" | "FAILED";
  bookingNext?: "bookings";
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withAuth<T>(
  run: (token: string | undefined) => Promise<{ data?: T; unauthorized?: boolean; message?: string }>,
): Promise<T> {
  const postOnce = async () => {
    let { data: sessionData } = await supabase.auth.getSession();
    let token = sessionData.session?.access_token;
    if (!token) {
      await safeRefreshSession();
      ({ data: sessionData } = await supabase.auth.getSession());
      token = sessionData.session?.access_token;
    }
    return run(token);
  };

  let out = await postOnce();
  if (out.unauthorized) {
    await safeRefreshSession();
    out = await postOnce();
  }
  if (out.data) return out.data;
  throw new Error(out.message ?? "Checkout failed");
}

export async function createPaypalOrder(body: CheckoutBody): Promise<CreateOrderResponse> {
  return withAuth<CreateOrderResponse>(async (token) => {
    const res = await fetch(env.paypalCreateOrderUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Partial<CreateOrderResponse> & { error?: string };
    if (res.status === 401) return { unauthorized: true };
    if (!res.ok) return { message: json.error ?? `HTTP ${res.status}` };
    if (!json.orderId || !json.approveUrl?.startsWith("https://")) {
      return { message: "Invalid PayPal order response" };
    }
    return { data: { orderId: json.orderId, approveUrl: json.approveUrl } };
  });
}

export async function capturePaypalOrder(orderId: string): Promise<CaptureOrderResponse> {
  const maxAttempts = 2;
  const retryDelayMs = 900;
  let last: CaptureOrderResponse | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const out = await withAuth<CaptureOrderResponse>(async (token) => {
      const res = await fetch(env.paypalCaptureOrderUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ orderId }),
      });
      const json = (await res.json().catch(() => ({}))) as Partial<CaptureOrderResponse> & { error?: string };
      if (res.status === 401) return { unauthorized: true };
      if (!res.ok) return { message: json.error ?? `HTTP ${res.status}` };
      if (json.status !== "COMPLETED" && json.status !== "PENDING" && json.status !== "FAILED") {
        return { message: "Invalid PayPal capture response" };
      }
      return { data: { status: json.status, bookingNext: json.bookingNext } };
    });

    if (out.status === "COMPLETED" || out.status === "FAILED") return out;
    last = out;
    if (attempt < maxAttempts) {
      await sleep(retryDelayMs);
    }
  }

  return last ?? { status: "PENDING" };
}

export async function createPaypalShoppingOrder(): Promise<CreateOrderResponse> {
  const successUrl = Linking.createURL("payment-success");
  const cancelUrl = Linking.createURL("payment-canceled");
  return createPaypalOrder({ return_url: successUrl, cancel_url: cancelUrl });
}

export async function createPaypalServiceBookingOrder(cartItemId: string): Promise<CreateOrderResponse> {
  const successUrl = Linking.createURL("payment-success");
  const cancelUrl = Linking.createURL("payment-canceled");
  return createPaypalOrder({ cart_item_id: cartItemId, return_url: successUrl, cancel_url: cancelUrl });
}
