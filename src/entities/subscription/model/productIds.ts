import { env } from "@/shared/lib/env";

export const PIXAI_PREMIUM_MONTHLY = env.pixAiMonthlySubscriptionSku;
export const PIXAI_PREMIUM_ANNUAL = env.pixAiAnnualSubscriptionSku;

export function isPremiumPlusProduct(productId: string | null | undefined): boolean {
  return productId === PIXAI_PREMIUM_ANNUAL;
}

export function isPaidPremiumProduct(productId: string | null | undefined): boolean {
  return productId === PIXAI_PREMIUM_MONTHLY || productId === PIXAI_PREMIUM_ANNUAL;
}
