import { useLayoutEffect } from "react";

type PaywallReason = "no_credits" | "upgrade";

type Nav = {
  replace: (name: "SubscriptionPaywall", params?: { reason?: PaywallReason }) => void;
};

/** After access is known, replace the gated screen with paywall so back returns to the origin route. */
export function useSubscriptionPaywallRedirect(params: {
  accessLoading: boolean;
  shouldEnforcePaywall: boolean;
  hasAccess: boolean;
  paywallReason?: PaywallReason;
  navigation: Nav;
}): void {
  const { accessLoading, shouldEnforcePaywall, hasAccess, paywallReason, navigation } = params;
  useLayoutEffect(() => {
    if (accessLoading) return;
    if (!shouldEnforcePaywall || hasAccess) return;
    navigation.replace("SubscriptionPaywall", { reason: paywallReason ?? "upgrade" });
  }, [accessLoading, shouldEnforcePaywall, hasAccess, paywallReason, navigation]);
}
