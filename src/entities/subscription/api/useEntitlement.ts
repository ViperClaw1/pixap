import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/app/providers/AuthProvider";

export type EntitlementStatus = "active" | "trialing" | "grace_period" | "expired" | "revoked" | "billing_retry";

export type SubscriptionEntitlement = {
  id: string;
  user_id: string;
  platform: "ios" | "android";
  product_id: string;
  status: EntitlementStatus;
  expires_at: string | null;
  is_trial: boolean;
  will_renew: boolean;
  latest_transaction_id: string | null;
  original_transaction_id: string | null;
  purchase_token: string | null;
  last_verified_at: string;
  store_environment?: "production" | "sandbox" | null;
};

const ACTIVE_STATUSES: EntitlementStatus[] = ["active", "trialing", "grace_period", "billing_retry"];
const INTRO_FREE_DAYS = 7;

export function useEntitlement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.subscription.entitlement(user?.id),
    enabled: Boolean(user?.id),
    staleTime: 120 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("subscription_entitlements")
        .select("*")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as SubscriptionEntitlement | null;
    },
  });

  const computed = useMemo(() => {
    const entitlement = query.data;
    const status = entitlement?.status;
    const isActive = status ? ACTIVE_STATUSES.includes(status) : false;
    const userCreatedAt = user?.created_at ? new Date(user.created_at) : null;
    const userCreatedAtMs = userCreatedAt?.getTime() ?? Number.NaN;
    const introTrialEndsAtMs = Number.isFinite(userCreatedAtMs)
      ? userCreatedAtMs + INTRO_FREE_DAYS * 24 * 60 * 60 * 1000
      : Number.NaN;
    const isIntroTrialActive = Number.isFinite(introTrialEndsAtMs) && Date.now() < introTrialEndsAtMs;
    const hasSubscriptionAccess = isActive;
    return {
      entitlement,
      isActive,
      hasSubscriptionAccess,
      isIntroTrialActive,
      introTrialEndsAt: Number.isFinite(introTrialEndsAtMs) ? new Date(introTrialEndsAtMs).toISOString() : null,
      isTrial: entitlement?.status === "trialing" || Boolean(entitlement?.is_trial),
      expiresAt: entitlement?.expires_at ?? null,
      storeEnvironment: entitlement?.store_environment ?? null,
      willRenew: entitlement?.will_renew ?? false,
      status: entitlement?.status ?? null,
    };
  }, [query.data, user?.created_at]);

  return {
    ...query,
    ...computed,
    refresh: async () => queryClient.invalidateQueries({ queryKey: queryKeys.subscription.entitlement(user?.id) }),
  };
}
