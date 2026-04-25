import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";
import { supabase } from "@/integrations/supabase/client";
import type { PurchasePayload, SubscriptionPurchase } from "@/services/subscriptionIapService";

type IapService = typeof import("@/services/subscriptionIapService");

function isExpoGoRuntime(): boolean {
  return Constants.appOwnership === "expo";
}

async function verifyPurchaseWithBackend(accessToken: string, payload: PurchasePayload, source: "purchase" | "restore" | "sync") {
  const { data, error } = await supabase.functions.invoke("iap-verify-purchase", {
    body: {
      ...payload,
      source,
    },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (error) throw new Error(error.message);
  return data as { entitlement?: Record<string, unknown>; error?: string };
}

export function useSubscription() {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const [iapReady, setIapReady] = useState(false);
  const [iapSupported, setIapSupported] = useState(!isExpoGoRuntime());
  const [iapService, setIapService] = useState<IapService | null>(null);

  const productIds = useMemo(
    () => [env.pixAiMonthlySubscriptionSku].filter((sku) => sku.length > 0),
    [],
  );

  const productsQuery = useQuery({
    queryKey: ["subscription-products", productIds.join("|"), iapReady],
    enabled: iapSupported && iapReady && productIds.length > 0 && Boolean(iapService),
    queryFn: async () => {
      if (!iapService) return [];
      return await iapService.fetchSubscriptionProducts(productIds);
    },
  });

  const verifyAndRefresh = useCallback(
    async (payload: PurchasePayload, source: "purchase" | "restore" | "sync", rawPurchase?: SubscriptionPurchase) => {
      if (!session?.access_token || !user?.id) throw new Error("Sign in required");
      const verified = await verifyPurchaseWithBackend(session.access_token, payload, source);
      if (verified?.error) throw new Error(verified.error);
      if (rawPurchase && iapService) {
        await iapService.acknowledgePurchase(rawPurchase);
      }
      await queryClient.invalidateQueries({ queryKey: ["subscription-entitlement", user.id] });
      return verified;
    },
    [iapService, queryClient, session?.access_token, user?.id],
  );

  useEffect(() => {
    let unsubscribe: () => void = () => {};
    let mounted = true;

    void (async () => {
      if (isExpoGoRuntime()) {
        setIapSupported(false);
        return;
      }
      try {
        const service = await import("@/services/subscriptionIapService");
        if (!mounted) return;
        setIapService(service);
        await service.initIapConnection();
        if (!mounted) return;
        setIapSupported(true);
        setIapReady(true);
        unsubscribe = service.startPurchaseListeners({
          onPurchase: async (purchase, raw) => {
            try {
              await verifyAndRefresh(purchase, "purchase", raw);
            } catch (error) {
              if (__DEV__) {
                console.warn("[subscription] purchase verification failed", error);
              }
            }
          },
          onError: (error) => {
            if (error.code !== "user-cancelled") {
              Alert.alert("Purchase error", error.message);
            }
          },
        });
      } catch (error) {
        setIapSupported(false);
        if (__DEV__) {
          console.warn("[subscription] IAP init failed", error);
        }
      }
    })();

    return () => {
      mounted = false;
      unsubscribe();
      if (iapService) {
        void iapService.endIapConnection();
      }
    };
  }, [iapService, verifyAndRefresh]);

  const buyMutation = useMutation({
    mutationFn: async () => {
      if (productIds.length === 0) throw new Error("Missing subscription SKU");
      if (!iapSupported || !iapService) {
        throw new Error("In-app purchases are not available in Expo Go. Use a development or production build.");
      }
      await iapService.startSubscriptionPurchase(productIds[0]);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      if (!iapSupported || !iapService) {
        throw new Error("In-app purchases are not available in Expo Go. Use a development or production build.");
      }
      const purchases = await iapService.restorePurchases();
      if (purchases.length === 0) return;
      for (const purchase of purchases) {
        await verifyAndRefresh(purchase, "restore");
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
  };
}
