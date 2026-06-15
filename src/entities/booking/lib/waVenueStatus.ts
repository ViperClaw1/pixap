import type { CartItem } from "@/entities/cart";
import { parseWaStatusLines } from "@/entities/cart/api/useCartItems";

export function waVenueStatusText(linkedCartItem?: Pick<CartItem, "wa_status_lines"> | null): string {
  return parseWaStatusLines(linkedCartItem?.wa_status_lines).join(" ").toLowerCase();
}

/** Venue replied that the requested slot is unavailable / declined. */
export function isWaVenueUnavailable(linkedCartItem?: Pick<CartItem, "wa_status_lines"> | null): boolean {
  const text = waVenueStatusText(linkedCartItem);
  return (
    text.includes("not available") ||
    text.includes("unavailable") ||
    text.includes("slot is not available") ||
    text.includes("declin") ||
    text.includes("reject") ||
    text.includes("недоступен") ||
    text.includes("отклон")
  );
}
