import { useLayoutEffect } from "react";

type Nav = { replace: (name: "SubscriptionPaywall") => void };

/** After entitlement is known, replace the gated screen with paywall so back returns to the origin route. */
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
    navigation.replace("SubscriptionPaywall");
  }, [entitlementLoading, shouldEnforcePaywall, hasSubscriptionAccess, navigation]);
}
