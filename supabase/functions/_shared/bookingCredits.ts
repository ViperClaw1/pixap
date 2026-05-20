import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const ACTIVE_STATUSES = ["active", "trialing", "grace_period", "billing_retry"] as const;

const RENEWAL_APPLE_TYPES = new Set([
  "DID_RENEW",
  "SUBSCRIBED",
  "DID_CHANGE_RENEWAL_STATUS",
  "OFFER_REDEEMED",
  "RENEWAL_EXTENDED",
]);

/** Google Play subscription notification types that grant/renew access */
const RENEWAL_GOOGLE_TYPES = new Set([1, 2, 4, 7, 8]);

export async function refillBookingCreditsForUser(
  admin: SupabaseClient,
  userId: string,
  productId: string,
): Promise<void> {
  const { error } = await admin.rpc("refill_booking_credits", {
    p_user_id: userId,
    p_product_id: productId,
  });
  if (error) {
    console.error("[bookingCredits] refill failed", { userId, productId, error });
  }
}

export async function refillBookingCreditsByEntitlementRef(
  admin: SupabaseClient,
  platform: "ios" | "android",
  ref: { originalTransactionId?: string | null; purchaseToken?: string | null },
): Promise<void> {
  let query = admin
    .from("subscription_entitlements")
    .select("user_id, product_id, status")
    .eq("platform", platform)
    .in("status", [...ACTIVE_STATUSES]);

  if (ref.originalTransactionId) {
    query = query.eq("original_transaction_id", ref.originalTransactionId);
  } else if (ref.purchaseToken) {
    query = query.eq("purchase_token", ref.purchaseToken);
  } else {
    return;
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data?.user_id || !data?.product_id) return;

  await refillBookingCreditsForUser(admin, data.user_id as string, data.product_id as string);
}

export function shouldRefillCreditsOnAppleNotification(notificationType?: string): boolean {
  if (!notificationType) return false;
  return RENEWAL_APPLE_TYPES.has(notificationType);
}

export function shouldRefillCreditsOnGoogleNotification(notificationType: number): boolean {
  return RENEWAL_GOOGLE_TYPES.has(notificationType);
}

export function shouldRefillCreditsOnVerifiedEntitlement(status: string): boolean {
  return (ACTIVE_STATUSES as readonly string[]).includes(status);
}
