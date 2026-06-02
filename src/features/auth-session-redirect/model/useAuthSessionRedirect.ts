import { useLayoutEffect } from "react";
import { useIsFocused } from "@react-navigation/native";
import type { AppNavigation } from "@/app/navigation/appNavigation";
import { navigateToAuthScreen } from "@/shared/lib/auth/authRequired";

/** When session is ready and there is no user, send the user to Profile → Auth (no embedded Auth screen). */
export function useAuthSessionRedirect(params: {
  authLoading: boolean;
  hasUser: boolean;
  navigation: AppNavigation;
}): void {
  const { authLoading, hasUser, navigation } = params;
  const isFocused = useIsFocused();
  useLayoutEffect(() => {
    if (!isFocused || authLoading || hasUser) return;
    navigateToAuthScreen(navigation);
  }, [authLoading, hasUser, isFocused, navigation]);
}
