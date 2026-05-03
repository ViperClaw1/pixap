import { useLayoutEffect } from "react";

type Nav = { navigate: (name: "SubscriptionPaywall") => void };

/** After entitlement is known, open the subscription paywall screen instead of embedding it. */
export function useSubscriptionPaywallRedirect(params: {
  entitlementLoading: boolean;
  shouldEnforcePaywall: boolean;
  isSubscriptionActive: boolean;
  navigation: Nav;
}): void {
  const { entitlementLoading, shouldEnforcePaywall, isSubscriptionActive, navigation } = params;
  useLayoutEffect(() => {
    if (entitlementLoading) return;
    if (!shouldEnforcePaywall || isSubscriptionActive) return;
    navigation.navigate("SubscriptionPaywall");
  }, [entitlementLoading, shouldEnforcePaywall, isSubscriptionActive, navigation]);
}
