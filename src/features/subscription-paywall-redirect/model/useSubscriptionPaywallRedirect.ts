import { useLayoutEffect } from "react";

type Nav = { navigate: (name: "SubscriptionPaywall") => void };

/** After entitlement is known, open the subscription paywall screen instead of embedding it. */
export function useSubscriptionPaywallRedirect(params: {
  entitlementLoading: boolean;
  shouldEnforcePaywall: boolean;
  hasSubscriptionAccess: boolean;
  navigation: Nav;
}): void {
  const { entitlementLoading, shouldEnforcePaywall, hasSubscriptionAccess, navigation } = params;
  useLayoutEffect(() => {
    if (entitlementLoading) return;
    if (!shouldEnforcePaywall || hasSubscriptionAccess) return;
    navigation.navigate("SubscriptionPaywall");
  }, [entitlementLoading, shouldEnforcePaywall, hasSubscriptionAccess, navigation]);
}
