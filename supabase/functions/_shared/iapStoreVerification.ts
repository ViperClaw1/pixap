import { SignJWT, importPKCS8 } from "https://esm.sh/jose@5.9.6";

export type VerifyPurchaseRequest = {
  platform: "ios" | "android";
  productId?: string;
  transactionId?: string;
  originalTransactionId?: string;
  transactionReceipt?: string;
  purchaseToken?: string;
  source?: "purchase" | "restore" | "sync";
  purchase?: Record<string, unknown>;
};

export type NormalizedEntitlement = {
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
  price_cents: number | null;
};

function normalizeStoreEnvironment(value: string | undefined): "production" | "sandbox" | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "sandbox") return "sandbox";
  if (normalized === "production") return "production";
  return null;
}

function decodeJwtPayload<T>(jwt: string): T {
  const parts = jwt.split(".");
  if (parts.length < 2) throw new Error("Invalid JWS payload");
  const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  return JSON.parse(raw) as T;
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
    `In Play Console -> Settings -> API access, link the service account with "Manage orders and subscriptions".`
  );
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

type AppleSubscriptionStatusApiBody = {
  data?: Array<{
    lastTransactions?: Array<{
      originalTransactionId?: string;
      signedTransactionInfo?: string;
      status?: number;
    }>;
  }>;
  errorCode?: number;
  errorMessage?: string;
};

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

async function fetchAppleSubscriptionStatus(
  originalTransactionId: string,
  token: string,
  baseUrl: string,
): Promise<{ response: Response; body: AppleSubscriptionStatusApiBody }> {
  const response = await fetch(`${baseUrl}/inApps/v1/subscriptions/${encodeURIComponent(originalTransactionId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await response.json().catch(() => ({}))) as AppleSubscriptionStatusApiBody;
  return { response, body };
}

export async function verifyIosPurchase(payload: VerifyPurchaseRequest): Promise<{ entitlement: NormalizedEntitlement; raw: unknown }> {
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

  return normalizeAppleSignedTransaction(lastBody.signedTransactionInfo, payload);
}

export async function verifyAppleSubscriptionByOriginalTransactionId(
  originalTransactionId: string,
  productId?: string | null,
): Promise<{ entitlement: NormalizedEntitlement; raw: unknown }> {
  const token = await createAppleToken();
  const baseUrls = resolveAppleStoreBaseUrls();
  let lastStatus = 0;
  let lastBody: AppleSubscriptionStatusApiBody = {};

  for (const baseUrl of baseUrls) {
    const { response, body } = await fetchAppleSubscriptionStatus(originalTransactionId, token, baseUrl);
    if (response.ok && body.data?.length) {
      lastBody = body;
      break;
    }
    lastStatus = response.status;
    lastBody = body;
    if (response.status !== 401 && response.status !== 404) break;
  }

  const lastTransaction = lastBody.data
    ?.flatMap((group) => group.lastTransactions ?? [])
    .find((transaction) => Boolean(transaction.signedTransactionInfo));

  if (!lastTransaction?.signedTransactionInfo) {
    const detail =
      typeof lastBody.errorMessage === "string"
        ? lastBody.errorMessage
        : lastBody.errorCode != null
          ? String(lastBody.errorCode)
          : "";
    throw new Error(
      `Apple subscription status failed (${lastStatus})${detail ? `: ${detail}` : ""} (tried: ${baseUrls.join(", ")})`,
    );
  }

  return {
    ...normalizeAppleSignedTransaction(lastTransaction.signedTransactionInfo, {
      productId: productId ?? undefined,
      originalTransactionId,
    }),
    raw: lastBody,
  };
}

export function normalizeAppleSignedTransaction(
  signedTransactionInfo: string,
  payload: Pick<VerifyPurchaseRequest, "productId" | "transactionId" | "originalTransactionId"> = {},
): { entitlement: NormalizedEntitlement; raw: unknown } {
  const transactionId = payload.transactionId;
  const transactionInfo = decodeJwtPayload<{
    productId?: string;
    transactionId?: string;
    originalTransactionId?: string;
    expiresDate?: number;
    revocationDate?: number;
    offerType?: number;
    environment?: string;
    price?: number;
  }>(signedTransactionInfo);

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
      latest_transaction_id: transactionInfo.transactionId ?? transactionId ?? null,
      original_transaction_id: transactionInfo.originalTransactionId ?? payload.originalTransactionId ?? null,
      purchase_token: null,
      store_environment: normalizeStoreEnvironment(transactionInfo.environment),
      price_cents:
        typeof transactionInfo.price === "number" && transactionInfo.price > 0
          ? Math.round(transactionInfo.price / 10)
          : null,
    },
    raw: { signedTransactionInfo },
  };
}

export async function verifyAndroidPurchase(payload: VerifyPurchaseRequest): Promise<{ entitlement: NormalizedEntitlement; raw: unknown }> {
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
      price_cents: null,
    },
    raw: body,
  };
}

export async function verifyStorePurchase(payload: VerifyPurchaseRequest): Promise<{ entitlement: NormalizedEntitlement; raw: unknown }> {
  return payload.platform === "ios" ? verifyIosPurchase(payload) : verifyAndroidPurchase(payload);
}
