import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  refillBookingCreditsForUser,
  shouldRefillCreditsOnAppleNotification,
} from "../_shared/bookingCredits.ts";
import { claimProcessedTransaction } from "../_shared/iapIdempotency.ts";
import { normalizeAppleSignedTransaction } from "../_shared/iapStoreVerification.ts";
import { verifyAppleSignedPayload } from "../_shared/iapWebhookVerification.ts";

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 204 });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });

  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!serviceKey || !supabaseUrl) throw new Error("Missing service role env");
    const admin = createClient(supabaseUrl, serviceKey);

    const bodyText = await req.text();
    const payload = JSON.parse(bodyText) as { signedPayload?: string; notificationUUID?: string };
    if (!payload.signedPayload) {
      return new Response(JSON.stringify({ error: "Missing signedPayload" }), { status: 400 });
    }

    const decoded = await verifyAppleSignedPayload<{
      notificationType?: string;
      subtype?: string;
      notificationUUID?: string;
      signedDate?: number;
      data?: { signedTransactionInfo?: string; bundleId?: string };
    }>(payload.signedPayload);
    const expectedBundleId = Deno.env.get("APPLE_BUNDLE_ID");
    if (expectedBundleId && decoded.data?.bundleId && decoded.data.bundleId !== expectedBundleId) {
      throw new Error("Apple notification bundleId mismatch");
    }
    const eventId = decoded.notificationUUID ?? payload.notificationUUID ?? crypto.randomUUID();

    await admin.from("subscription_events").upsert(
      {
        platform: "ios",
        source: "apple_assn",
        event_id: eventId,
        event_type: decoded.notificationType ?? null,
        event_time: decoded.signedDate ? new Date(decoded.signedDate).toISOString() : null,
        payload: decoded,
        payload_hash: await sha256Hex(bodyText),
      },
      { onConflict: "platform,event_id" },
    );

    if (decoded.data?.signedTransactionInfo) {
      const tx = await verifyAppleSignedPayload<{
        productId?: string;
        originalTransactionId?: string;
        transactionId?: string;
        expiresDate?: number;
        revocationDate?: number;
      }>(decoded.data.signedTransactionInfo);
      const { entitlement } = normalizeAppleSignedTransaction(decoded.data.signedTransactionInfo);
      const expiresAt = tx.expiresDate ? new Date(tx.expiresDate).toISOString() : null;
      const status = tx.revocationDate
        ? "revoked"
        : tx.expiresDate && tx.expiresDate <= Date.now()
          ? "expired"
          : "active";

      if (tx.originalTransactionId) {
        const { data: updatedEntitlement, error: updateError } = await admin
          .from("subscription_entitlements")
          .update({
            status,
            expires_at: expiresAt,
            latest_transaction_id: tx.transactionId ?? null,
            will_renew: status === "active",
            updated_at: new Date().toISOString(),
            last_verified_at: new Date().toISOString(),
          })
          .eq("platform", "ios")
          .eq("original_transaction_id", tx.originalTransactionId)
          .select("id,user_id,product_id")
          .maybeSingle();
        if (updateError) throw updateError;

        if (
          updatedEntitlement?.user_id &&
          updatedEntitlement?.product_id &&
          status === "active" &&
          shouldRefillCreditsOnAppleNotification(decoded.notificationType)
        ) {
          const firstProcessing = await claimProcessedTransaction(admin, {
            platform: "ios",
            transactionId: entitlement.latest_transaction_id ?? tx.transactionId,
            originalTransactionId: tx.originalTransactionId,
            userId: updatedEntitlement.user_id as string,
            entitlementId: updatedEntitlement.id as string,
            source: "apple_assn",
          });
          if (firstProcessing) {
            await refillBookingCreditsForUser(
              admin,
              updatedEntitlement.user_id as string,
              updatedEntitlement.product_id as string,
            );
          }
        }
      }
    }

    await admin
      .from("subscription_events")
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq("platform", "ios")
      .eq("event_id", eventId);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[iap-apple-notifications]", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
