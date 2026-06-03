import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  refillBookingCreditsForUser,
  shouldRefillCreditsOnVerifiedEntitlement,
} from "../_shared/bookingCredits.ts";
import { claimProcessedTransaction } from "../_shared/iapIdempotency.ts";
import {
  type NormalizedEntitlement,
  verifyAndroidPurchase,
  verifyAppleSubscriptionByOriginalTransactionId,
  verifyIosPurchase,
} from "../_shared/iapStoreVerification.ts";

const ACTIVE_STATUSES = ["active", "trialing", "grace_period", "billing_retry"] as const;

type EntitlementRow = {
  id: string;
  user_id: string;
  platform: "ios" | "android";
  product_id: string;
  status: string;
  expires_at: string | null;
  will_renew: boolean;
  latest_transaction_id: string | null;
  original_transaction_id: string | null;
  purchase_token: string | null;
  store_environment: "production" | "sandbox" | null;
};

function assertAuthorized(req: Request): void {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const cronSecret = Deno.env.get("IAP_RECONCILIATION_SECRET");
  if (!token || (token !== serviceKey && token !== cronSecret)) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
}

function changedFields(before: EntitlementRow, after: NormalizedEntitlement): string[] {
  const fields: string[] = [];
  if (before.status !== after.status) fields.push("status");
  if ((before.expires_at ?? null) !== (after.expires_at ?? null)) fields.push("expires_at");
  if (before.will_renew !== after.will_renew) fields.push("will_renew");
  if ((before.latest_transaction_id ?? null) !== (after.latest_transaction_id ?? null)) fields.push("latest_transaction_id");
  if ((before.store_environment ?? null) !== (after.store_environment ?? null)) fields.push("store_environment");
  return fields;
}

async function revalidateEntitlement(row: EntitlementRow): Promise<{ entitlement: NormalizedEntitlement; raw: unknown }> {
  if (row.platform === "ios") {
    if (row.original_transaction_id) {
      return await verifyAppleSubscriptionByOriginalTransactionId(row.original_transaction_id, row.product_id);
    }
    if (row.latest_transaction_id) {
      return await verifyIosPurchase({
        platform: "ios",
        productId: row.product_id,
        transactionId: row.latest_transaction_id,
        originalTransactionId: row.original_transaction_id ?? undefined,
        purchase: {},
      });
    }
    throw new Error("iOS entitlement has no transaction reference");
  }

  if (!row.purchase_token) throw new Error("Android entitlement has no purchase token");
  return await verifyAndroidPurchase({
    platform: "android",
    productId: row.product_id,
    purchaseToken: row.purchase_token,
    purchase: {},
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  try {
    assertAuthorized(req);
    const body = (await req.json().catch(() => ({}))) as { limit?: number };
    const limit = Math.min(Math.max(Number(body.limit ?? 200), 1), 1000);

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!serviceKey || !supabaseUrl) throw new Error("Missing service role env");
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: rows, error } = await admin
      .from("subscription_entitlements")
      .select(
        "id,user_id,platform,product_id,status,expires_at,will_renew,latest_transaction_id,original_transaction_id,purchase_token,store_environment",
      )
      .in("status", [...ACTIVE_STATUSES])
      .order("last_verified_at", { ascending: true })
      .limit(limit);
    if (error) throw error;

    const summary = { checked: 0, changed: 0, errors: 0 };

    for (const row of (rows ?? []) as EntitlementRow[]) {
      summary.checked += 1;
      try {
        const verification = await revalidateEntitlement(row);
        const fields = changedFields(row, verification.entitlement);
        const hasChanged = fields.length > 0;

        const { error: updateError } = await admin
          .from("subscription_entitlements")
          .update({
            product_id: verification.entitlement.product_id,
            status: verification.entitlement.status,
            expires_at: verification.entitlement.expires_at,
            is_trial: verification.entitlement.is_trial,
            will_renew: verification.entitlement.will_renew,
            original_transaction_id: verification.entitlement.original_transaction_id,
            purchase_token: verification.entitlement.purchase_token,
            latest_transaction_id: verification.entitlement.latest_transaction_id,
            store_environment: verification.entitlement.store_environment,
            last_verified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        if (updateError) throw updateError;

        if (hasChanged) summary.changed += 1;
        await admin.from("subscription_reconciliation_audit").insert({
          entitlement_id: row.id,
          user_id: row.user_id,
          platform: row.platform,
          action: hasChanged ? "state_changed" : "no_change",
          previous_status: row.status,
          new_status: verification.entitlement.status,
          previous_expires_at: row.expires_at,
          new_expires_at: verification.entitlement.expires_at,
          details: { changed_fields: fields },
        });

        if (shouldRefillCreditsOnVerifiedEntitlement(verification.entitlement.status)) {
          const firstProcessing = await claimProcessedTransaction(admin, {
            platform: row.platform,
            transactionId: verification.entitlement.latest_transaction_id ?? verification.entitlement.purchase_token,
            originalTransactionId: verification.entitlement.original_transaction_id,
            purchaseToken: verification.entitlement.purchase_token,
            userId: row.user_id,
            entitlementId: row.id,
            source: "reconciliation",
          });
          if (firstProcessing) {
            await refillBookingCreditsForUser(admin, row.user_id, verification.entitlement.product_id);
          }
        }
      } catch (error) {
        summary.errors += 1;
        await admin.from("subscription_reconciliation_audit").insert({
          entitlement_id: row.id,
          user_id: row.user_id,
          platform: row.platform,
          action: "error",
          previous_status: row.status,
          new_status: row.status,
          previous_expires_at: row.expires_at,
          new_expires_at: row.expires_at,
          error_text: error instanceof Error ? error.message : "Unknown reconciliation error",
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, ...summary }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[iap-reconcile-subscriptions]", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
