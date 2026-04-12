import { Alert, Linking } from "react-native";
import { env } from "@/lib/env";
import type { ShoppingCartItem } from "@/hooks/useShoppingItems";

export type WhatsAppAvailabilityKind = "restaurant" | "service" | "goods";

const TEMPLATE_RESTAURANT = `Hello! 👋  
This is the PixaI team.

A customer would like to reserve a table at your restaurant.  
Please confirm availability:

Yes / No

Thank you in advance for your quick response 🙏`;

const TEMPLATE_SERVICE = `Hello! 👋  
This is the PixaI team.

A customer would like to book your service.  
Please confirm availability:

Yes / No

Thank you in advance for your quick response 🙏`;

const TEMPLATE_GOODS = `Hello! 👋  
This is the PixaI team.

A customer would like to order your product.  
Please confirm availability:

Yes / No

Thank you in advance for your quick response 🙏`;

const MAX_MESSAGE_CHARS = 1800;

function templateForKind(kind: WhatsAppAvailabilityKind): string {
  switch (kind) {
    case "restaurant":
      return TEMPLATE_RESTAURANT;
    case "goods":
      return TEMPLATE_GOODS;
    default:
      return TEMPLATE_SERVICE;
  }
}

/** Strip to digits; return null if length is not plausible for international WhatsApp. */
export function normalizeWhatsAppDigits(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== "string") return null;
  let d = raw.replace(/\D/g, "");
  if (d.length === 0) return null;
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  if (d.length < 8 || d.length > 15) return null;
  return d;
}

export function resolveWhatsAppPhone(contact_whatsapp: string | null | undefined): string {
  return normalizeWhatsAppDigits(contact_whatsapp) ?? env.pixaiWhatsAppDigits;
}

export function buildAvailabilityMessage(
  kind: WhatsAppAvailabilityKind,
  context: { businessName: string; extraLines?: string[] },
): string {
  const header = templateForKind(kind);
  const lines: string[] = ["", "---", `Business: ${context.businessName.trim() || "—"}`];
  if (context.extraLines?.length) {
    for (const line of context.extraLines) {
      const t = line.trim();
      if (t) lines.push(t);
    }
  }
  let body = [header, ...lines].join("\n");
  if (body.length > MAX_MESSAGE_CHARS) {
    body = body.slice(0, MAX_MESSAGE_CHARS - 1) + "…";
  }
  return body;
}

export async function openWhatsAppAvailability(phoneDigits: string, message: string): Promise<void> {
  const url = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
  const supported = await Linking.canOpenURL(url).catch(() => false);
  if (!supported) {
    Alert.alert("WhatsApp unavailable", "Could not open WhatsApp on this device.");
    return;
  }
  await Linking.openURL(url);
}

export function serviceCartContextLines(params: {
  dateTimeLabel: string;
  persons: number | null | undefined;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  comment?: string | null;
}): string[] {
  const out: string[] = [`Slot: ${params.dateTimeLabel}`];
  if (params.persons != null) out.push(`Persons: ${params.persons}`);
  if (params.customer_name?.trim()) out.push(`Customer: ${params.customer_name.trim()}`);
  if (params.customer_phone?.trim()) out.push(`Phone: ${params.customer_phone.trim()}`);
  if (params.customer_email?.trim()) out.push(`Email: ${params.customer_email.trim()}`);
  if (params.comment?.trim()) out.push(`Comment: ${params.comment.trim()}`);
  return out;
}

function shoppingLineTotal(item: ShoppingCartItem): number {
  return (
    (item.shopping_item?.price || 0) * item.quantity +
    (item.children ?? []).reduce((s, c) => s + (c.shopping_item?.price || 0) * c.quantity, 0)
  );
}

/** One vendor → that vendor’s WhatsApp (or fallback). Multiple vendors → PixAI inbox + vendor list in body. */
export function resolveShoppingWhatsAppPhone(items: ShoppingCartItem[]): string {
  const mains = items.filter((i) => !i.parent_id);
  const vendorIds = new Set(mains.map((i) => i.business_card_id));
  if (vendorIds.size === 1) {
    const w = mains[0]?.business_card?.contact_whatsapp;
    return resolveWhatsAppPhone(w ?? null);
  }
  return env.pixaiWhatsAppDigits;
}

export function shoppingCartContextLines(items: ShoppingCartItem[]): string[] {
  const mains = items.filter((i) => !i.parent_id);
  const lines: string[] = [];
  if (mains.length === 0) return lines;
  const vendorIds = new Set(mains.map((i) => i.business_card_id));
  if (vendorIds.size > 1) {
    lines.push("Multiple vendors — please coordinate each line below.");
  }
  for (const row of mains) {
    const vendor = row.business_card?.name?.trim() ?? "—";
    const product = row.shopping_item?.name ?? "—";
    const total = shoppingLineTotal(row);
    lines.push(`${vendor} — ${product} ×${row.quantity} — ${total.toLocaleString()} ₸`);
    for (const c of row.children ?? []) {
      lines.push(`  + ${c.shopping_item?.name ?? "—"} ×${c.quantity}`);
    }
  }
  return lines;
}
