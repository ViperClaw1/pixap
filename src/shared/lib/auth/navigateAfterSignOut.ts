import { CommonActions } from "@react-navigation/native";
import { rootNavigationRef } from "@/app/navigation/rootNavigationRef";

let signOutNavigationDone = false;

/** Reset Profile stack to Auth once per sign-out (avoids competing dispatches from multiple screens). */
export function navigateAfterSignOut(): void {
  if (signOutNavigationDone) return;
  signOutNavigationDone = true;

  const resetProfileToAuth = () => {
    if (!rootNavigationRef.isReady()) return false;
    if (!rootNavigationRef.current) return false;
    const state = rootNavigationRef.getState();
    if (!state?.routes?.length) return false;
    const profileTabIndex = state.routes.findIndex((route) => route.name === "Profile");
    const nextIndex = profileTabIndex >= 0 ? profileTabIndex : state.index;

    rootNavigationRef.dispatch(
      CommonActions.reset({
        index: nextIndex,
        routes: state.routes.map((route) =>
          route.name === "Profile"
            ? {
                ...route,
                state: {
                  index: 0,
                  routes: [{ name: "Auth" }],
                },
              }
            : route,
        ),
      }),
    );
    return true;
  };

  if (resetProfileToAuth()) return;

  requestAnimationFrame(() => {
    if (resetProfileToAuth()) return;
    setTimeout(() => {
      resetProfileToAuth();
    }, 100);
  });
}

/** Call when a new authenticated session starts so the next sign-out can navigate again. */
export function resetSignOutNavigationGuard(): void {
  signOutNavigationDone = false;
}
