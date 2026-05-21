/** Venue price from WhatsApp flow (`cart_items.wa_confirmed_price`), e.g. "1500 ₽" or "25 USD". */
export function venueConfirmedPriceLabel(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  const numericMatch = trimmed.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  const amount = numericMatch ? Number(numericMatch[1]) : NaN;
  if (Number.isFinite(amount) && amount <= 0) return null;

  return trimmed;
}
