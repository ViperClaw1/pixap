import { supabase } from "@/shared/api/supabase/client";

export type WaInterfaceLocale = "ru" | "en";

export function normalizeWaInterfaceLocale(lang: string | null | undefined): WaInterfaceLocale {
  const base = (lang ?? "").split("-")[0]?.toLowerCase() ?? "";
  return base === "ru" ? "ru" : "en";
}

type N8nErrorBody = {
  error?: string;
  hint?: string;
  step?: string;
  n8n_status?: number;
  n8n_message?: string;
  n8n_body_preview?: string;
  wa_booking_status?: number;
  wa_booking_body_preview?: string;
};

export function formatN8nWaBookingStartError(error: unknown, data: unknown): string {
  const base = error instanceof Error ? error.message : "Invoke failed";
  const ctx =
    error && typeof error === "object" && "context" in error
      ? (error as { context?: { body?: string } }).context
      : undefined;
  const rawBody = ctx?.body;

  if (rawBody) {
    try {
      const j = JSON.parse(rawBody) as N8nErrorBody;
      if (j.error) {
        let msg = `${base} [${j.step ?? "?"}] ${j.error}`;
        if (j.n8n_message) msg += `: ${j.n8n_message}`;
        if (j.hint) msg += ` — ${j.hint}`;
        const upstream = j.wa_booking_status ?? j.n8n_status;
        if (upstream != null) {
          msg += j.wa_booking_status != null ? ` (booking service HTTP ${upstream})` : ` (n8n HTTP ${upstream})`;
        }
        return msg;
      }
    } catch {
      return `${base} ${rawBody.slice(0, 160)}`;
    }
  }

  if (data && typeof data === "object" && data !== null && "error" in data) {
    const j = data as { error?: string; hint?: string; step?: string };
    const errText = typeof j.error === "string" ? j.error : base;
    return `${base}: ${errText}${j.step ? ` [${j.step}]` : ""}${j.hint ? ` — ${j.hint}` : ""}`;
  }

  return base;
}

export async function invokeN8nWaBookingStart(
  cartItemId: string,
  accessToken: string,
  interfaceLocale: WaInterfaceLocale,
) {
  return supabase.functions.invoke("n8n-wa-booking-start", {
    body: { cart_item_id: cartItemId, interface_locale: interfaceLocale },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function startN8nWaBooking(
  cartItemId: string,
  accessToken: string,
  interfaceLocale: WaInterfaceLocale = "en",
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await invokeN8nWaBookingStart(cartItemId, accessToken, interfaceLocale);
  if (!error) return { ok: true };
  return { ok: false, message: formatN8nWaBookingStartError(error, data) };
}
