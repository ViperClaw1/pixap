import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type IapPlatform = "ios" | "android";
export type IapSource = "purchase" | "restore" | "sync" | "apple_assn" | "google_rtdn" | "reconciliation";

export class PurchaseOwnershipError extends Error {
  constructor() {
    super("Purchase is already linked to another account");
    this.name = "PurchaseOwnershipError";
  }
}

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

export function buildProcessedTransactionId(platform: IapPlatform, transactionId?: string | null): string | null {
  const normalized = transactionId?.trim();
  return normalized ? `${platform}:${normalized}` : null;
}

export function resolveStoreReference(input: {
  platform: IapPlatform;
  originalTransactionId?: string | null;
  purchaseToken?: string | null;
  transactionId?: string | null;
}): string | null {
  if (input.platform === "ios") {
    return input.originalTransactionId?.trim() || input.transactionId?.trim() || null;
  }
  return input.purchaseToken?.trim() || input.transactionId?.trim() || null;
}

export async function assertPermanentPurchaseOwnership(
  admin: SupabaseClient,
  input: {
    platform: IapPlatform;
    userId: string;
    productId?: string | null;
    originalTransactionId?: string | null;
    purchaseToken?: string | null;
    transactionId?: string | null;
  },
): Promise<void> {
  const storeReference = resolveStoreReference(input);
  if (!storeReference) return;

  const { data, error } = await admin
    .from("subscription_purchase_ownerships")
    .select("user_id")
    .eq("platform", input.platform)
    .eq("store_reference", storeReference)
    .maybeSingle();
  if (error) throw error;
  if (data?.user_id && data.user_id !== input.userId) {
    throw new PurchaseOwnershipError();
  }
  if (data?.user_id === input.userId) return;

  const { error: insertError } = await admin
    .from("subscription_purchase_ownerships")
    .insert({
      platform: input.platform,
      store_reference: storeReference,
      user_id: input.userId,
      product_id: input.productId ?? null,
      original_transaction_id: input.originalTransactionId ?? null,
      purchase_token: input.purchaseToken ?? null,
      first_transaction_id: input.transactionId ?? null,
    });

  if (isUniqueViolation(insertError)) {
    const { data: owner, error: ownerError } = await admin
      .from("subscription_purchase_ownerships")
      .select("user_id")
      .eq("platform", input.platform)
      .eq("store_reference", storeReference)
      .maybeSingle();
    if (ownerError) throw ownerError;
    if (owner?.user_id !== input.userId) throw new PurchaseOwnershipError();
    return;
  }
  if (insertError) throw insertError;
}

export async function claimProcessedTransaction(
  admin: SupabaseClient,
  input: {
    platform: IapPlatform;
    transactionId?: string | null;
    originalTransactionId?: string | null;
    purchaseToken?: string | null;
    userId?: string | null;
    entitlementId?: string | null;
    source: IapSource;
  },
): Promise<boolean> {
  const processedTransactionId = buildProcessedTransactionId(input.platform, input.transactionId);
  if (!processedTransactionId) return false;

  const { error } = await admin
    .from("processed_transactions")
    .insert({
      transaction_id: processedTransactionId,
      platform: input.platform,
      original_transaction_id: input.originalTransactionId ?? null,
      purchase_token: input.purchaseToken ?? null,
      user_id: input.userId ?? null,
      entitlement_id: input.entitlementId ?? null,
      source: input.source,
    });

  if (!error) return true;
  if (isUniqueViolation(error)) return false;
  throw error;
}
