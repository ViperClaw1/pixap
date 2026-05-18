import type { WaBookingQrPayload } from "../model/types";

export function parseWaQrPayload(raw: unknown): WaBookingQrPayload | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const str = (key: string) => (typeof o[key] === "string" ? String(o[key]).trim() : "");
  const client_name = str("client_name");
  const place_name = str("place_name");
  const booking_date = str("booking_date");
  const booking_slot = str("booking_slot");
  if (!client_name || !place_name || !booking_date || !booking_slot) return null;
  if (typeof o.is_free !== "boolean") return null;
  const price =
    o.price == null ? null : typeof o.price === "string" ? String(o.price).trim() || null : null;
  return {
    client_name,
    client_phone: str("client_phone") || "—",
    place_name,
    booking_date,
    booking_slot,
    is_free: o.is_free,
    price: o.is_free ? null : price,
  };
}

export function buildBookingQrValue(payload: WaBookingQrPayload): string {
  return JSON.stringify(payload);
}
