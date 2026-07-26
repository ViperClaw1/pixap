import { useCallback } from "react";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { useBookingAccess } from "@/features/booking-access";
import { shouldEnforceSubscriptionPaywall } from "./shouldEnforceSubscriptionPaywall";

type GatedScreen = "AIBooking" | "VibeMatch" | "BookingFlow";

type GatedScreenParams = {
  id?: string;
  prefillCity?: string;
  prefillMood?: string;
  sourceFlow?: "ai_concierge";
};

export function useSubscriptionGatedNavigation(navigation: NavigationProp<ParamListBase>) {
  const {
    isLoading: accessLoading,
    canAccessBookingFlow,
    canAccessAIBooking,
    canAccessVibeMatch,
    balance,
  } = useBookingAccess();
  const shouldEnforcePaywall = shouldEnforceSubscriptionPaywall();

  const openGatedScreen = useCallback(
    (screen: GatedScreen, params?: GatedScreenParams) => {
      const allowed =
        screen === "BookingFlow"
          ? canAccessBookingFlow
          : screen === "AIBooking"
            ? canAccessAIBooking
            : canAccessVibeMatch;
      if (shouldEnforcePaywall && !accessLoading && !allowed) {
        navigation.navigate("SubscriptionPaywall", { reason: balance <= 0 ? "no_credits" : "upgrade" });
        return;
      }
      if (params != null) {
        navigation.navigate(screen, params);
        return;
      }
      navigation.navigate(screen);
    },
    [
      accessLoading,
      canAccessAIBooking,
      canAccessBookingFlow,
      canAccessVibeMatch,
      balance,
      navigation,
      shouldEnforcePaywall,
    ],
  );

  const openAIBooking = useCallback(
    (params?: { id?: string }) => openGatedScreen("AIBooking", params),
    [openGatedScreen],
  );

  const openVibeMatch = useCallback(
    (params?: Omit<GatedScreenParams, "id">) => openGatedScreen("VibeMatch", params),
    [openGatedScreen],
  );

  const openBookingFlow = useCallback(
    (params: { id: string }) => openGatedScreen("BookingFlow", params),
    [openGatedScreen],
  );

  return {
    openAIBooking,
    openBookingFlow,
    openVibeMatch,
    shouldEnforcePaywall,
    canAccessBookingFlow,
    canAccessAIBooking,
    canAccessVibeMatch,
    accessLoading,
  };
}
