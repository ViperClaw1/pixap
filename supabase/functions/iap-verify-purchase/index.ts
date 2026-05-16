import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-expect-error Deno runtime resolves remote URL imports for Edge Functions.
import { SignJWT, importPKCS8 } from "https://esm.sh/jose@5.9.6";
import { corsHeaders } from "../_shared/cors.ts";

type VerifyPurchaseRequest = {
  platform: "ios" | "android";
  productId?: string;
  transactionId?: string;
  originalTransactionId?: string;
  transactionReceipt?: string;
  purchaseToken?: string;
  source?: "purchase" | "restore" | "sync";
  purchase?: Record<string, unknown>;
};

type NormalizedEntitlement = {
  platform: "ios" | "android";
  product_id: string;
  status: "active" | "trialing" | "grace_period" | "expired" | "revoked" | "billing_retry";
  expires_at: string | null;
  is_trial: boolean;
  will_renew: boolean;
  latest_transaction_id: string | null;
  original_transaction_id: string | null;
  purchase_token: string | null;
  store_environment: "production" | "sandbox" | null;
};

function normalizeStoreEnvironment(value: string | undefined): "production" | "sandbox" | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "sandbox") return "sandbox";
  if (normalized === "production") return "production";
  return null;
}

function formatGoogleVerificationError(status: number, body: Record<string, unknown>): string {
  const nested = body.error as { message?: string; status?: string } | undefined;
  const detail =
    (typeof nested?.message === "string" && nested.message) ||
    (typeof body.error_description === "string" && body.error_description) ||
    (typeof body.message === "string" && body.message) ||
    "";
  const base = `Google verification failed (${status})${detail ? `: ${detail}` : ""}`;
  if (status !== 401 && status !== 403) return base;
  return (
    `${base}. Check Supabase secrets: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, ` +
    `GOOGLE_PLAY_PACKAGE_NAME=com.pixap.pixap. In Google Cloud enable "Google Play Android Developer API". ` +
    `In Play Console → Settings → API access, link the service account with "Manage orders and subscriptions".`
  );
}

function decodeJwtPayload<T>(jwt: string): T {
  const parts = jwt.split(".");
  if (parts.length < 2) throw new Error("Invalid JWS payload");
  const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  return JSON.parse(raw) as T;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function createAppleToken(): Promise<string> {
  const issuerId = Deno.env.get("APPLE_ISSUER_ID");
  const keyId = Deno.env.get("APPLE_KEY_ID");
  const bundleId = Deno.env.get("APPLE_BUNDLE_ID");
  const privateKey = Deno.env.get("APPLE_PRIVATE_KEY");
  if (!issuerId || !keyId || !bundleId || !privateKey) {
    throw new Error("Missing Apple server API credentials");
  }
  const key = await importPKCS8(privateKey.replace(/\\n/g, "\n"), "ES256");
  return await new SignJWT({ bid: bundleId })
    .setProtectedHeader({ alg: "ES256", kid: keyId, typ: "JWT" })
    .setIssuer(issuerId)
    .setAudience("appstoreconnect-v1")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
}

async function createGoogleAccessToken(): Promise<string> {
  const clientEmail = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
  if (!clientEmail || !privateKey) {
    throw new Error("Missing Google service account credentials");
  }
  const now = Math.floor(Date.now() / 1000);
  const assertionKey = await importPKCS8(privateKey.replace(/\\n/g, "\n"), "RS256");
  const jwt = await new SignJWT({
    scope: "https://www.googleapis.com/auth/androidpublisher",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(clientEmail)
    .setSubject(clientEmail)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(assertionKey);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = (await response.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(data.error ?? `Google token request failed (${response.status})`);
  }
  return data.access_token;
}

const APPLE_STOREKIT_PRODUCTION = "https://api.storekit.itunes.apple.com";
const APPLE_STOREKIT_SANDBOX = "https://api.storekit-sandbox.itunes.apple.com";

type AppleTransactionApiBody = {
  signedTransactionInfo?: string;
  errorCode?: number;
  errorMessage?: string;
};

/** Production first, then sandbox — required for Sandbox/TestFlight purchases when env URL is unset. */
function resolveAppleStoreBaseUrls(): string[] {
  const configured = Deno.env.get("APPLE_APP_STORE_SERVER_URL")?.replace(/\/$/, "");
  if (!configured) return [APPLE_STOREKIT_PRODUCTION, APPLE_STOREKIT_SANDBOX];
  const alternate = configured.includes("sandbox") ? APPLE_STOREKIT_PRODUCTION : APPLE_STOREKIT_SANDBOX;
  return configured === alternate ? [configured] : [configured, alternate];
}

async function fetchAppleTransaction(
  transactionId: string,
  token: string,
  baseUrl: string,
): Promise<{ response: Response; body: AppleTransactionApiBody }> {
  const response = await fetch(`${baseUrl}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await response.json().catch(() => ({}))) as AppleTransactionApiBody;
  return { response, body };
}

async function verifyIosPurchase(payload: VerifyPurchaseRequest): Promise<{ entitlement: NormalizedEntitlement; raw: unknown }> {
  const transactionId =
    payload.transactionId ??
    (typeof payload.purchase?.transactionId === "string" ? payload.purchase.transactionId : undefined);
  if (!transactionId) throw new Error("Missing transactionId for iOS verification");

  const token = await createAppleToken();
  const baseUrls = resolveAppleStoreBaseUrls();
  let lastStatus = 0;
  let lastBody: AppleTransactionApiBody = {};

  for (const baseUrl of baseUrls) {
    const { response, body } = await fetchAppleTransaction(transactionId, token, baseUrl);
    if (response.ok && body.signedTransactionInfo) {
      lastBody = body;
      break;
    }
    lastStatus = response.status;
    lastBody = body;
    if (response.status !== 401 && response.status !== 404) break;
  }

  if (!lastBody.signedTransactionInfo) {
    const detail =
      typeof lastBody.errorMessage === "string"
        ? lastBody.errorMessage
        : lastBody.errorCode != null
          ? String(lastBody.errorCode)
          : "";
    throw new Error(
      `Apple verification failed (${lastStatus})${detail ? `: ${detail}` : ""} (tried: ${baseUrls.join(", ")})`,
    );
  }

  const transactionInfo = decodeJwtPayload<{
    productId?: string;
    transactionId?: string;
    originalTransactionId?: string;
    expiresDate?: number;
    revocationDate?: number;
    offerType?: number;
    environment?: string;
  }>(lastBody.signedTransactionInfo);

  const now = Date.now();
  const expiresAtMs = typeof transactionInfo.expiresDate === "number" ? transactionInfo.expiresDate : null;
  const expired = expiresAtMs != null && expiresAtMs <= now;
  const revoked = typeof transactionInfo.revocationDate === "number";
  const status: NormalizedEntitlement["status"] = revoked ? "revoked" : expired ? "expired" : "active";
  const isTrial = transactionInfo.offerType === 1;

  return {
    entitlement: {
      platform: "ios",
      product_id: transactionInfo.productId ?? payload.productId ?? "unknown",
      status: status === "active" && isTrial ? "trialing" : status,
      expires_at: expiresAtMs != null ? new Date(expiresAtMs).toISOString() : null,
      is_trial: isTrial,
      will_renew: !expired && !revoked,
      latest_transaction_id: transactionInfo.transactionId ?? transactionId,
      original_transaction_id: transactionInfo.originalTransactionId ?? payload.originalTransactionId ?? null,
      purchase_token: null,
      store_environment: normalizeStoreEnvironment(transactionInfo.environment),
    },
    raw: lastBody,
  };
}

async function verifyAndroidPurchase(payload: VerifyPurchaseRequest): Promise<{ entitlement: NormalizedEntitlement; raw: unknown }> {
  const packageName = Deno.env.get("GOOGLE_PLAY_PACKAGE_NAME");
  if (!packageName) throw new Error("Missing GOOGLE_PLAY_PACKAGE_NAME");

  const purchaseToken =
    payload.purchaseToken ??
    (typeof payload.purchase?.purchaseToken === "string" ? payload.purchase.purchaseToken : undefined);
  const productId =
    payload.productId ??
    (typeof payload.purchase?.productId === "string" ? payload.purchase.productId : undefined);
  if (!purchaseToken || !productId) {
    throw new Error("Missing purchaseToken or productId for Android verification");
  }

  const accessToken = await createGoogleAccessToken();
  const endpoint =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}` +
    `/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;

  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = (await response.json().catch(() => ({}))) as {
    subscriptionState?: string;
    testPurchase?: Record<string, unknown>;
    lineItems?: Array<{
      productId?: string;
      expiryTime?: string;
      offerDetails?: { basePlanId?: string; offerTags?: string[] };
      autoRenewingPlan?: { autoRenewEnabled?: boolean };
    }>;
    latestOrderId?: string;
    linkedPurchaseToken?: string;
    error?: { message?: string; status?: string };
    error_description?: string;
    message?: string;
  };
  if (!response.ok) {
    throw new Error(formatGoogleVerificationError(response.status, body as Record<string, unknown>));
  }

  const line = body.lineItems?.find((it) => it.productId === productId) ?? body.lineItems?.[0];
  const expiresAt = line?.expiryTime ?? null;
  const state = body.subscriptionState ?? "SUBSCRIPTION_STATE_UNSPECIFIED";
  const statusMap: Record<string, NormalizedEntitlement["status"]> = {
    SUBSCRIPTION_STATE_ACTIVE: "active",
    SUBSCRIPTION_STATE_IN_GRACE_PERIOD: "grace_period",
    SUBSCRIPTION_STATE_ON_HOLD: "billing_retry",
    SUBSCRIPTION_STATE_PAUSED: "billing_retry",
    SUBSCRIPTION_STATE_CANCELED: "expired",
    SUBSCRIPTION_STATE_EXPIRED: "expired",
  };
  const isTrial = Array.isArray(line?.offerDetails?.offerTags)
    ? line?.offerDetails?.offerTags?.includes("trial")
    : false;

  return {
    entitlement: {
      platform: "android",
      product_id: line?.productId ?? productId,
      status: isTrial && statusMap[state] === "active" ? "trialing" : (statusMap[state] ?? "expired"),
      expires_at: expiresAt,
      is_trial: Boolean(isTrial),
      will_renew: Boolean(line?.autoRenewingPlan?.autoRenewEnabled),
      latest_transaction_id: body.latestOrderId ?? null,
      original_transaction_id: null,
      purchase_token: purchaseToken,
      store_environment: body.testPurchase ? "sandbox" : "production",
    },
    raw: body,
  };
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

    let verification: { entitlement: NormalizedEntitlement; raw: unknown };
    if (payload.platform === "ios") {
      verification = await verifyIosPurchase(payload);
    } else {
      verification = await verifyAndroidPurchase(payload);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

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

    return new Response(JSON.stringify({ entitlement: verification.entitlement }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[iap-verify-purchase]", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
