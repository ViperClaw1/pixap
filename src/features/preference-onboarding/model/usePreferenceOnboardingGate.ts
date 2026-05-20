import { useEffect, useRef } from "react";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { useAuth } from "@/app/providers/AuthProvider";
import { isOnboardingSkipped, useUserPreferences } from "@/entities/user-preferences";

export function usePreferenceOnboardingGate(navigation: NavigationProp<ParamListBase>): void {
  const { user, loading: authLoading } = useAuth();
  const { data: prefs, isLoading: prefsLoading } = useUserPreferences();
  const didNavigateRef = useRef(false);

  useEffect(() => {
    if (authLoading || prefsLoading || !user || didNavigateRef.current) return;
    if (prefs?.onboarding_completed) return;
    if (isOnboardingSkipped(prefs)) return;

    didNavigateRef.current = true;
    navigation.navigate("PreferenceOnboarding", { source: "gate" });
  }, [authLoading, navigation, prefs, prefsLoading, user]);
}
