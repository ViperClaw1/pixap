import { useCallback } from "react";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { useEntitlement } from "@/entities/subscription";
import { shouldEnforceSubscriptionPaywall } from "./shouldEnforceSubscriptionPaywall";

type GatedScreen = "AIBooking" | "VibeMatch";

export function useSubscriptionGatedNavigation(navigation: NavigationProp<ParamListBase>) {
  const { hasSubscriptionAccess, isLoading: entitlementLoading } = useEntitlement();
  const shouldEnforcePaywall = shouldEnforceSubscriptionPaywall();

  const openGatedScreen = useCallback(
    (screen: GatedScreen, params?: { id?: string }) => {
      if (shouldEnforcePaywall && !entitlementLoading && !hasSubscriptionAccess) {
        navigation.navigate("SubscriptionPaywall");
        return;
      }
      if (params != null) {
        navigation.navigate(screen, params);
        return;
      }
      navigation.navigate(screen);
    },
    [entitlementLoading, hasSubscriptionAccess, navigation, shouldEnforcePaywall],
  );

  const openAIBooking = useCallback(
    (params?: { id?: string }) => openGatedScreen("AIBooking", params),
    [openGatedScreen],
  );

  const openVibeMatch = useCallback(() => openGatedScreen("VibeMatch"), [openGatedScreen]);

  return {
    openAIBooking,
    openVibeMatch,
    shouldEnforcePaywall,
    hasSubscriptionAccess,
    entitlementLoading,
  };
}
