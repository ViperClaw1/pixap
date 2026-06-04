import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";
import Constants from "expo-constants";
import { useAuth } from "@/app/providers/AuthProvider";
import { env } from "@/shared/lib/env";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { devWarn } from "@/shared/lib/devLog";
import type { PurchasePayload, SubscriptionPurchase } from "@/shared/lib/iap/subscriptionIapService";

type IapService = typeof import("@/shared/lib/iap/subscriptionIapService");

export type VerificationState =
  | { status: "idle" }
  | { status: "verifying" }
  | { status: "success" }
  | { status: "error"; code: SubscriptionErrorCode };

export type SubscriptionErrorCode =
  | "auth_required"
  | "invalid_purchase"
  | "purchase_already_linked"
  | "verification_unavailable"
  | "verification_failed"
  | "network_unavailable"
  | "iap_unavailable"
  | "missing_sku"
  | "no_eligible_offer"
  | "store_purchase_failed"
  | "restore_no_purchases"
  | "restore_failed";

type SubscriptionError = Error & { code: SubscriptionErrorCode };

function isExpoGoRuntime(): boolean {
  return Constants.appOwnership === "expo";
}

function purchaseDedupeKey(payload: PurchasePayload): string | null {
  return payload.transactionId ?? payload.originalTransactionId ?? payload.purchaseToken ?? null;
}

function createSubscriptionError(code: SubscriptionErrorCode, message: string): SubscriptionError {
  return Object.assign(new Error(message), { code });
}

function isSubscriptionErrorCode(value: unknown): value is SubscriptionErrorCode {
  return (
    value === "auth_required" ||
    value === "invalid_purchase" ||
    value === "purchase_already_linked" ||
    value === "verification_unavailable" ||
    value === "verification_failed" ||
    value === "network_unavailable" ||
    value === "iap_unavailable" ||
    value === "missing_sku" ||
    value === "no_eligible_offer" ||
    value === "store_purchase_failed" ||
    value === "restore_no_purchases" ||
    value === "restore_failed"
  );
}

function getSubscriptionErrorCode(error: unknown, fallback: SubscriptionErrorCode): SubscriptionErrorCode {
  const code = (error as { code?: unknown })?.code;
  return isSubscriptionErrorCode(code) ? code : fallback;
}

function classifyVerifyHttpStatus(status: number): SubscriptionErrorCode {
  if (status === 401) return "auth_required";
  if (status === 400) return "invalid_purchase";
  if (status === 409) return "purchase_already_linked";
  return "verification_unavailable";
}

async function parseFunctionErrorPayload(error: FunctionsHttpError): Promise<{ code?: unknown; error?: unknown }> {
  try {
    return (await error.context.json()) as { code?: unknown; error?: unknown };
  } catch {
    return {};
  }
}

async function verifyPurchaseWithBackend(accessToken: string, payload: PurchasePayload, source: "purchase" | "restore" | "sync") {
  const { data, error } = await supabase.functions.invoke("iap-verify-purchase", {
    body: {
      ...payload,
      source,
    },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (error instanceof FunctionsHttpError) {
    const payload = await parseFunctionErrorPayload(error);
    const bodyCode = isSubscriptionErrorCode(payload.code) ? payload.code : undefined;
    const code = bodyCode ?? classifyVerifyHttpStatus(error.context.status);
    const message = typeof payload.error === "string" ? payload.error : error.message;
    throw createSubscriptionError(code, message);
  }
  if (error instanceof FunctionsFetchError) {
    throw createSubscriptionError("network_unavailable", error.message);
  }
  if (error instanceof FunctionsRelayError) {
    throw createSubscriptionError("verification_unavailable", error.message);
  }
  if (error) throw createSubscriptionError("verification_failed", error.message);
  return data as { entitlement?: Record<string, unknown>; error?: string };
}

async function syncStatusWithBackend(accessToken: string) {
  const { data, error } = await supabase.functions.invoke("iap-sync-status", {
    headers: { Authorization: `Bearer ${accessToken}` },
    body: {},
  });
  if (error) throw new Error(error.message);
  return data as { entitlement?: Record<string, unknown> | null };
}

export function useSubscription() {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const [iapReady, setIapReady] = useState(false);
  const [iapSupported, setIapSupported] = useState(!isExpoGoRuntime());
  const [iapService, setIapService] = useState<IapService | null>(null);
  const [verificationState, setVerificationState] = useState<VerificationState>({ status: "idle" });
  const iapServiceRef = useRef<IapService | null>(null);
  const authRef = useRef<{ userId: string | null; accessToken: string | null }>({ userId: null, accessToken: null });

  useEffect(() => {
    iapServiceRef.current = iapService;
  }, [iapService]);

  useEffect(() => {
    authRef.current = {
      userId: user?.id ?? null,
      accessToken: session?.access_token ?? null,
    };
  }, [session?.access_token, user?.id]);

  const productIds = useMemo(
    () => [env.pixAiMonthlySubscriptionSku, env.pixAiAnnualSubscriptionSku].filter((sku) => sku.length > 0),
    [],
  );

  const productsQuery = useQuery({
    queryKey: queryKeys.subscription.products(productIds.join("|"), iapReady),
    enabled: iapSupported && iapReady && productIds.length > 0 && Boolean(iapService),
    queryFn: async () => {
      if (!iapService) return [];
      return await iapService.fetchSubscriptionProducts(productIds);
    },
  });

  const verifyAndRefresh = useCallback(
    async (
      payload: PurchasePayload,
      source: "purchase" | "restore" | "sync",
      rawPurchase?: SubscriptionPurchase,
      options: { silent?: boolean } = {},
    ) => {
      const shouldUpdateVerificationState = source !== "sync" && !options.silent;
      if (shouldUpdateVerificationState) {
        setVerificationState({ status: "verifying" });
      }
      try {
        const { accessToken, userId } = authRef.current;
        if (!accessToken || !userId) throw createSubscriptionError("auth_required", "Sign in required");
        const verified = await verifyPurchaseWithBackend(accessToken, payload, source);
        if (verified?.error) throw createSubscriptionError("verification_failed", verified.error);
        if (rawPurchase && iapServiceRef.current) {
          await iapServiceRef.current.acknowledgePurchase(rawPurchase);
        }
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.subscription.entitlement(userId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.bookingCredits.prefix }),
        ]);
        if (shouldUpdateVerificationState) {
          setVerificationState({ status: "success" });
        }
        return verified;
      } catch (error) {
        if (shouldUpdateVerificationState) {
          setVerificationState({ status: "error", code: getSubscriptionErrorCode(error, "verification_failed") });
        }
        throw error;
      }
    },
    [queryClient],
  );

  useEffect(() => {
    let unsubscribe: () => void = () => {};
    let mounted = true;
    let serviceInstance: IapService | null = null;

    void (async () => {
      if (isExpoGoRuntime()) {
        setIapSupported(false);
        return;
      }
      try {
        const service = await import("@/shared/lib/iap/subscriptionIapService");
        if (!mounted) return;
        setIapService(service);
        serviceInstance = service;
        await service.initIapConnection();
        if (!mounted) return;
        setIapSupported(true);
        setIapReady(true);
        unsubscribe = service.startPurchaseListeners({
          onPurchase: async (purchase, raw) => {
            try {
              await verifyAndRefresh(purchase, "purchase", raw);
            } catch (error) {
              devWarn("[subscription] purchase verification failed", error);
            }
          },
          onError: (error) => {
            if (error.code !== "user-cancelled") {
              Alert.alert("Purchase error", error.message);
            }
          },
        });
        const pendingPurchases = await service.getPendingPurchases();
        for (const purchase of pendingPurchases) {
          try {
            await verifyAndRefresh(purchase.payload, "purchase", purchase.raw, { silent: true });
          } catch (error) {
            devWarn("[subscription] pending purchase verification failed", error);
          }
        }
      } catch (error) {
        setIapSupported(false);
        devWarn("[subscription] IAP init failed", error);
      }
    })();

    return () => {
      mounted = false;
      unsubscribe();
      if (serviceInstance) {
        void serviceInstance.endIapConnection();
      }
    };
  }, [verifyAndRefresh]);

  useEffect(() => {
    if (!session?.access_token || !user?.id) return;
    void syncStatusWithBackend(session.access_token)
      .then(() =>
        Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.subscription.entitlement(user.id) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.bookingCredits.prefix }),
        ]),
      )
      .catch((error) => {
        devWarn("[subscription] sync-status failed", error);
      });
  }, [queryClient, session?.access_token, user?.id]);

  const buyMutation = useMutation({
    mutationFn: async (sku?: string) => {
      const targetSku = sku ?? productIds[0];
      if (!targetSku || productIds.length === 0) {
        throw createSubscriptionError("missing_sku", "Missing subscription SKU");
      }
      if (!iapSupported || !iapService) {
        throw createSubscriptionError(
          "iap_unavailable",
          "In-app purchases are not available in Expo Go. Use a development or production build.",
        );
      }
      setVerificationState({ status: "idle" });
      try {
        await iapService.startSubscriptionPurchase(targetSku, productsQuery.data ?? []);
      } catch (error) {
        if ((error as { code?: string })?.code === "user-cancelled") throw error;
        const message = error instanceof Error ? error.message : "Purchase failed";
        if (message.toLowerCase().includes("no eligible")) {
          throw createSubscriptionError("no_eligible_offer", message);
        }
        throw createSubscriptionError("store_purchase_failed", message);
      }
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      if (!iapSupported || !iapService) {
        throw createSubscriptionError(
          "iap_unavailable",
          "In-app purchases are not available in Expo Go. Use a development or production build.",
        );
      }
      setVerificationState({ status: "idle" });
      const purchases = await iapService.restorePurchases().catch((error: unknown) => {
        if ((error as { code?: string })?.code === "user-cancelled") throw error;
        const message = error instanceof Error ? error.message : "Restore failed";
        throw createSubscriptionError("restore_failed", message);
      });
      if (purchases.length === 0) {
        throw createSubscriptionError("restore_no_purchases", "No purchases to restore");
      }
      const seenPurchases = new Set<string>();
      let restoredCount = 0;
      for (const purchase of purchases) {
        if (!purchase.payload.productId || !productIds.includes(purchase.payload.productId)) continue;
        const key = purchaseDedupeKey(purchase.payload);
        if (!key || seenPurchases.has(key)) continue;
        seenPurchases.add(key);
        await verifyAndRefresh(purchase.payload, "restore", purchase.raw);
        restoredCount += 1;
      }
      if (restoredCount === 0) {
        throw createSubscriptionError("restore_no_purchases", "No purchases to restore");
      }
    },
  });

  return {
    iapReady,
    iapSupported,
    productIds,
    products: productsQuery.data ?? [],
    productsLoading: productsQuery.isLoading,
    purchase: buyMutation.mutateAsync,
    restore: restoreMutation.mutateAsync,
    purchasePending: buyMutation.isPending,
    restorePending: restoreMutation.isPending,
    verificationState,
    verifying: verificationState.status === "verifying",
    resetVerificationState: () => setVerificationState({ status: "idle" }),
  };
}
