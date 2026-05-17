import * as Linking from "expo-linking";
import type { NavigationContainerRefWithCurrent } from "@react-navigation/native";
import { shouldRouteToAuthEmailCallback } from "@/shared/lib/supabaseAuthDeepLink";
import type { RootTabParamList } from "./types";

const DEDUPE_MS = 3000;

/**
 * Routes Supabase redirect URLs into `Profile/AuthEmailCallback` with full `href` so tokens in `#hash`
 * are not lost when React Navigation only maps pathname.
 */
export function subscribeSupabaseAuthDeepLinks(
  navigationRef: NavigationContainerRefWithCurrent<RootTabParamList>,
): () => void {
  let lastHref: string | null = null;
  let lastEnqueuedAt = 0;

  const enqueue = (href: string | null) => {
    if (!href || !shouldRouteToAuthEmailCallback(href)) return;

    const now = Date.now();
    if (href === lastHref && now - lastEnqueuedAt < DEDUPE_MS) return;
    lastHref = href;
    lastEnqueuedAt = now;

    const navigate = () => {
      if (!navigationRef.isReady()) return false;
      navigationRef.navigate("Profile", { screen: "AuthEmailCallback", params: { href } });
      return true;
    };

    if (navigate()) return;

    requestAnimationFrame(() => {
      if (!navigate()) {
        setTimeout(() => navigate(), 100);
      }
    });
  };

  void Linking.getInitialURL().then((href) => enqueue(href));

  const sub = Linking.addEventListener("url", (event) => enqueue(event.url));

  return () => sub.remove();
}
