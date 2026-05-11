import * as Linking from "expo-linking";
import type { NavigationContainerRefWithCurrent } from "@react-navigation/native";
import type { RootTabParamList } from "@/navigation/types";
import { shouldRouteToAuthEmailCallback } from "./supabaseAuthDeepLink";

/**
 * Routes Supabase redirect URLs into `Profile/AuthEmailCallback` with full `href` so tokens in `#hash`
 * are not lost when React Navigation only maps pathname.
 */
export function subscribeSupabaseAuthDeepLinks(
  navigationRef: NavigationContainerRefWithCurrent<RootTabParamList>,
): () => void {
  const enqueue = (href: string | null) => {
    if (!href || !shouldRouteToAuthEmailCallback(href)) return;
    const navigate = () => {
      if (!navigationRef.isReady()) return;
      navigationRef.navigate("Profile", { screen: "AuthEmailCallback", params: { href } });
    };
    navigate();
    requestAnimationFrame(navigate);
    setTimeout(navigate, 50);
    setTimeout(navigate, 200);
  };

  void Linking.getInitialURL().then((href) => enqueue(href));

  const sub = Linking.addEventListener("url", (event) => enqueue(event.url));

  return () => sub.remove();
}
