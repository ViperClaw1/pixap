import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
};

const ACTIVE_STATUSES: EntitlementStatus[] = ["active", "trialing", "grace_period", "billing_retry"];

export function useEntitlement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["subscription-entitlement", user?.id],
    enabled: Boolean(user?.id),
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
    return {
      entitlement,
      isActive,
      isTrial: entitlement?.status === "trialing" || Boolean(entitlement?.is_trial),
      expiresAt: entitlement?.expires_at ?? null,
      willRenew: entitlement?.will_renew ?? false,
      status: entitlement?.status ?? null,
    };
  }, [query.data]);

  return {
    ...query,
    ...computed,
    refresh: async () => queryClient.invalidateQueries({ queryKey: ["subscription-entitlement", user?.id] }),
  };
}
