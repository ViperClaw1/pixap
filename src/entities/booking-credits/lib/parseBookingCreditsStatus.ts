import type { Json } from "@/shared/api/supabase/types";
import type { BookingCreditsStatus } from "../model/types";

export function parseBookingCreditsStatus(raw: Json | null): BookingCreditsStatus | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const balance = typeof row.balance === "number" ? row.balance : Number(row.balance);
  const introPeriodEndsAt =
    typeof row.intro_period_ends_at === "string" ? row.intro_period_ends_at : "";
  if (!Number.isFinite(balance) || !introPeriodEndsAt) return null;

  return {
    balance,
    introPeriodEndsAt,
    isIntroActive: row.is_intro_active === true,
    hasPaidPremium: row.has_paid_premium === true,
    hasPremiumPlus: row.has_premium_plus === true,
    activeProductId:
      typeof row.active_product_id === "string" && row.active_product_id.length > 0
        ? row.active_product_id
        : null,
  };
}
