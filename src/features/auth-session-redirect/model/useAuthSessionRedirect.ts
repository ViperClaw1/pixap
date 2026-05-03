import { useLayoutEffect } from "react";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { navigateToAuthScreen } from "@/lib/authRequired";

/** When session is ready and there is no user, send the user to Profile → Auth (no embedded Auth screen). */
export function useAuthSessionRedirect(params: {
  authLoading: boolean;
  hasUser: boolean;
  navigation: NavigationProp<ParamListBase>;
}): void {
  const { authLoading, hasUser, navigation } = params;
  useLayoutEffect(() => {
    if (authLoading || hasUser) return;
    navigateToAuthScreen(navigation);
  }, [authLoading, hasUser, navigation]);
}
