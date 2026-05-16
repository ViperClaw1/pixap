import { useLayoutEffect } from "react";
import type { AppNavigation } from "@/app/navigation/appNavigation";
import { navigateToAuthScreen } from "@/shared/lib/auth/authRequired";

/** When session is ready and there is no user, send the user to Profile → Auth (no embedded Auth screen). */
export function useAuthSessionRedirect(params: {
  authLoading: boolean;
  hasUser: boolean;
  navigation: AppNavigation;
}): void {
  const { authLoading, hasUser, navigation } = params;
  useLayoutEffect(() => {
    if (authLoading || hasUser) return;
    navigateToAuthScreen(navigation);
  }, [authLoading, hasUser, navigation]);
}
