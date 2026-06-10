import { Platform } from "react-native";
import { env } from "@/shared/lib/env";

/** Google Play subscription SKUs */
export const PIXAI_PREMIUM_MONTHLY_ANDROID = "pixai_premium_monthly";
export const PIXAI_PREMIUM_ANNUAL_ANDROID = "pixai_premium_annual";

/** App Store subscription SKUs */
export const PIXAI_PREMIUM_MONTHLY_IOS = "pix_monthly";
export const PIXAI_PREMIUM_ANNUAL_IOS = "pix_annual";

const PREMIUM_MONTHLY_PRODUCT_IDS = [PIXAI_PREMIUM_MONTHLY_ANDROID, PIXAI_PREMIUM_MONTHLY_IOS] as const;
const PREMIUM_ANNUAL_PRODUCT_IDS = [PIXAI_PREMIUM_ANNUAL_ANDROID, PIXAI_PREMIUM_ANNUAL_IOS] as const;

/** Store SKU for the current platform (purchase / product fetch). */
export function getPixAiMonthlySubscriptionSku(): string {
  if (Platform.OS === "ios") return PIXAI_PREMIUM_MONTHLY_IOS;
  return env.pixAiMonthlySubscriptionSku;
}

export function getPixAiAnnualSubscriptionSku(): string {
  if (Platform.OS === "ios") return PIXAI_PREMIUM_ANNUAL_IOS;
  return env.pixAiAnnualSubscriptionSku;
}

export function getSubscriptionProductIds(): string[] {
  return [getPixAiMonthlySubscriptionSku(), getPixAiAnnualSubscriptionSku()].filter((sku) => sku.length > 0);
}

export function isPremiumPlusProduct(productId: string | null | undefined): boolean {
  if (!productId) return false;
  return (PREMIUM_ANNUAL_PRODUCT_IDS as readonly string[]).includes(productId);
}

export function isPaidPremiumProduct(productId: string | null | undefined): boolean {
  if (!productId) return false;
  return (
    (PREMIUM_MONTHLY_PRODUCT_IDS as readonly string[]).includes(productId) ||
    (PREMIUM_ANNUAL_PRODUCT_IDS as readonly string[]).includes(productId)
  );
}
