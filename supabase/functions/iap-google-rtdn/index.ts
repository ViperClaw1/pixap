import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  refillBookingCreditsForUser,
  shouldRefillCreditsOnGoogleNotification,
} from "../_shared/bookingCredits.ts";
import { claimProcessedTransaction } from "../_shared/iapIdempotency.ts";
import { verifyAndroidPurchase } from "../_shared/iapStoreVerification.ts";
import { verifyGooglePubSubRequest } from "../_shared/iapWebhookVerification.ts";

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type PubSubEnvelope = {
  message?: {
    messageId?: string;
    data?: string;
    publishTime?: string;
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 204 });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });

  try {
    await verifyGooglePubSubRequest(req);

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!serviceKey || !supabaseUrl) throw new Error("Missing service role env");
    const admin = createClient(supabaseUrl, serviceKey);

    const bodyText = await req.text();
    const envelope = JSON.parse(bodyText) as PubSubEnvelope;
    const base64Data = envelope.message?.data;
    if (!base64Data) return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200 });

    const decodedMessage = JSON.parse(atob(base64Data)) as {
      packageName?: string;
      eventTimeMillis?: string;
      subscriptionNotification?: {
        subscriptionId?: string;
        purchaseToken?: string;
        notificationType?: number;
      };
    };
    const expectedPackageName = Deno.env.get("GOOGLE_PLAY_PACKAGE_NAME");
    if (expectedPackageName && decodedMessage.packageName && decodedMessage.packageName !== expectedPackageName) {
      throw new Error("Google RTDN packageName mismatch");
    }
    const notification = decodedMessage.subscriptionNotification;
    if (!notification?.purchaseToken || !notification.subscriptionId) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200 });
    }

    const eventId = envelope.message?.messageId ?? crypto.randomUUID();
    const notificationType = notification.notificationType ?? -1;
    await admin.from("subscription_events").upsert(
      {
        platform: "android",
        source: "google_rtdn",
        event_id: eventId,
        event_type: String(notificationType),
        event_time: decodedMessage.eventTimeMillis
          ? new Date(Number(decodedMessage.eventTimeMillis)).toISOString()
          : envelope.message?.publishTime ?? null,
        payload: decodedMessage,
        payload_hash: await sha256Hex(bodyText),
      },
      { onConflict: "platform,event_id" },
    );

    const verification = await verifyAndroidPurchase({
      platform: "android",
      productId: notification.subscriptionId,
      purchaseToken: notification.purchaseToken,
      purchase: {},
    });
    const normalizedStatus =
      notificationType === 12 ? "revoked" : verification.entitlement.status;

    const { data: updatedEntitlement, error: updateError } = await admin
      .from("subscription_entitlements")
      .update({
        status: normalizedStatus,
        product_id: verification.entitlement.product_id,
        expires_at: verification.entitlement.expires_at,
        latest_transaction_id: verification.entitlement.latest_transaction_id,
        store_environment: verification.entitlement.store_environment,
        will_renew:
          normalizedStatus === "active" ||
          normalizedStatus === "trialing" ||
          normalizedStatus === "grace_period",
        updated_at: new Date().toISOString(),
        last_verified_at: new Date().toISOString(),
      })
      .eq("platform", "android")
      .eq("purchase_token", notification.purchaseToken)
      .select("id,user_id,product_id")
      .maybeSingle();
    if (updateError) throw updateError;

    if (
      updatedEntitlement?.user_id &&
      updatedEntitlement?.product_id &&
      (normalizedStatus === "active" || normalizedStatus === "trialing" || normalizedStatus === "grace_period") &&
      shouldRefillCreditsOnGoogleNotification(notificationType)
    ) {
      const firstProcessing = await claimProcessedTransaction(admin, {
        platform: "android",
        transactionId: verification.entitlement.latest_transaction_id ?? notification.purchaseToken,
        purchaseToken: notification.purchaseToken,
        userId: updatedEntitlement.user_id as string,
        entitlementId: updatedEntitlement.id as string,
        source: "google_rtdn",
      });
      if (firstProcessing) {
        await refillBookingCreditsForUser(
          admin,
          updatedEntitlement.user_id as string,
          updatedEntitlement.product_id as string,
        );
      }
    }

    await admin
      .from("subscription_events")
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq("platform", "android")
      .eq("event_id", eventId);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[iap-google-rtdn]", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
