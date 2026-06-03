import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  refillBookingCreditsForUser,
  shouldRefillCreditsOnVerifiedEntitlement,
} from "../_shared/bookingCredits.ts";
import { assertPermanentPurchaseOwnership, claimProcessedTransaction, PurchaseOwnershipError } from "../_shared/iapIdempotency.ts";
import { type VerifyPurchaseRequest, verifyStorePurchase } from "../_shared/iapStoreVerification.ts";

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = (await req.json()) as VerifyPurchaseRequest;
    if (payload.platform !== "ios" && payload.platform !== "android") {
      return new Response(JSON.stringify({ error: "Invalid platform" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const verification = await verifyStorePurchase(payload);
    await assertPermanentPurchaseOwnership(admin, {
      platform: verification.entitlement.platform,
      userId: userData.user.id,
      productId: verification.entitlement.product_id,
      originalTransactionId: verification.entitlement.original_transaction_id,
      purchaseToken: verification.entitlement.purchase_token,
      transactionId: verification.entitlement.latest_transaction_id,
    });

    const rawJson = JSON.stringify(verification.raw);
    const payloadHash = await sha256Hex(rawJson);
    const source = payload.source ?? "purchase";

    const { data: entitlementRow, error: entitlementError } = await admin
      .from("subscription_entitlements")
      .upsert(
        {
          user_id: userData.user.id,
          platform: verification.entitlement.platform,
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
        },
        { onConflict: "user_id,product_id,platform" },
      )
      .select("id")
      .single();
    if (entitlementError) throw entitlementError;

    const entitlementId = entitlementRow?.id as string | undefined;
    await admin.from("subscription_receipts").upsert(
      {
        user_id: userData.user.id,
        platform: verification.entitlement.platform,
        product_id: verification.entitlement.product_id,
        original_transaction_id: verification.entitlement.original_transaction_id,
        purchase_token: verification.entitlement.purchase_token,
        source,
        raw_payload: verification.raw,
        raw_payload_hash: payloadHash,
      },
      { onConflict: "platform,raw_payload_hash" },
    );

    const firstProcessing = await claimProcessedTransaction(admin, {
      platform: verification.entitlement.platform,
      transactionId: verification.entitlement.latest_transaction_id ?? verification.entitlement.purchase_token,
      originalTransactionId: verification.entitlement.original_transaction_id,
      purchaseToken: verification.entitlement.purchase_token,
      userId: userData.user.id,
      entitlementId,
      source,
    });

    if (firstProcessing) {
      await admin.from("subscription_transactions").insert({
        user_id: userData.user.id,
        entitlement_id: entitlementId ?? null,
        platform: verification.entitlement.platform,
        product_id: verification.entitlement.product_id,
        transaction_id: verification.entitlement.latest_transaction_id,
        original_transaction_id: verification.entitlement.original_transaction_id,
        purchase_token: verification.entitlement.purchase_token,
        expires_at: verification.entitlement.expires_at,
        status: verification.entitlement.status === "active" ? "purchased" : verification.entitlement.status,
        is_trial: verification.entitlement.is_trial,
        raw_payload: verification.raw,
        raw_payload_hash: payloadHash,
      });
    }

    if (firstProcessing && shouldRefillCreditsOnVerifiedEntitlement(verification.entitlement.status)) {
      await refillBookingCreditsForUser(
        admin,
        userData.user.id,
        verification.entitlement.product_id,
      );
    }

    return new Response(JSON.stringify({ entitlement: verification.entitlement }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[iap-verify-purchase]", error);
    if (error instanceof PurchaseOwnershipError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
