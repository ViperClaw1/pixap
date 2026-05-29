import { CommonActions, type NavigationProp, type ParamListBase } from "@react-navigation/native";
import type { MutableRefObject } from "react";
import type {
  MessageThreadRouteParams,
  NavigationReturnTarget,
  PublicProfileRouteParams,
  RootTabName,
} from "./types";

const TAB_MAIN_SCREEN: Record<RootTabName, string> = {
  Home: "HomeMain",
  Feed: "FeedMain",
  Bookings: "BookingsMain",
  Cart: "CartMain",
  Profile: "ProfileMain",
};

type StackPushNav = NavigationProp<ParamListBase> & {
  push: (name: string, params?: object) => void;
};

function findTabNavigator(nav: NavigationProp<ParamListBase>): NavigationProp<ParamListBase> | null {
  let node: NavigationProp<ParamListBase> | undefined = nav;
  while (node) {
    if (node.getState().type === "tab") return node;
    node = node.getParent() ?? undefined;
  }
  return null;
}

function findCartStackNavigator(nav: NavigationProp<ParamListBase>): NavigationProp<ParamListBase> | null {
  let node: NavigationProp<ParamListBase> | undefined = nav;
  while (node) {
    const routeNames = node.getState().routeNames ?? [];
    if (routeNames.includes("CartMain") && routeNames.includes("MessageThread")) {
      return node;
    }
    node = node.getParent() ?? undefined;
  }
  return null;
}

function resetNestedTabStack(
  tabNav: NavigationProp<ParamListBase>,
  tabName: RootTabName,
  mainScreen: string,
) {
  const state = tabNav.getState();
  tabNav.dispatch(
    CommonActions.reset({
      index: state.index,
      routes: state.routes.map((route) =>
        route.name === tabName
          ? {
              ...route,
              state: {
                index: 0,
                routes: [{ name: mainScreen }],
              },
            }
          : route,
      ),
    }),
  );
}

export function isCartStackNavigation(nav: NavigationProp<ParamListBase>): boolean {
  return nav.getState().routeNames?.includes("CartMain") ?? false;
}

export function isBrowseStackNavigation(nav: NavigationProp<ParamListBase>): boolean {
  const routeNames = nav.getState().routeNames ?? [];
  if (routeNames.includes("CartMain")) return false;
  const browseStackMarkers = ["FeedMain", "HomeMain", "BookingsMain", "ProfileMain"] as const;
  return browseStackMarkers.some((marker) => routeNames.includes(marker));
}

/** Resolves the bottom-tab name for the navigator that owns `nav`. */
export function getCurrentRootTabName(nav: NavigationProp<ParamListBase>): RootTabName | null {
  const tabNav = findTabNavigator(nav);
  if (!tabNav) return null;
  const state = tabNav.getState();
  const index = state.index ?? 0;
  const name = state.routes[index]?.name;
  if (name === "Home" || name === "Feed" || name === "Bookings" || name === "Cart" || name === "Profile") {
    return name;
  }
  return null;
}

export function navigateToRootTabScreen(
  nav: NavigationProp<ParamListBase>,
  target: NavigationReturnTarget,
) {
  const tabNav = findTabNavigator(nav);
  if (!tabNav) return;
  tabNav.dispatch(
    CommonActions.navigate({
      name: target.tab,
      params: {
        screen: target.screen,
        params: target.params,
      },
    }),
  );
}

export type NavigateToPublicProfileOptions = {
  returnTab?: RootTabName;
  returnScreen?: string;
};

/** Open Profile tab → Auth (tabs stay visible). */
export function navigateToProfileAuth(nav: NavigationProp<ParamListBase>) {
  const parent = nav.getParent();
  if (!parent) return;
  parent.dispatch(
    CommonActions.navigate({
      name: "Profile",
      params: { screen: "Auth" },
    }),
  );
}

/** Switch to Home tab root (e.g. after login). */
export function navigateToHomeMain(nav: NavigationProp<ParamListBase>) {
  const parent = nav.getParent();
  if (!parent) return;
  parent.dispatch(
    CommonActions.navigate({
      name: "Home",
      params: { screen: "HomeMain" },
    }),
  );
}

export function navigateToFeedTab(nav: NavigationProp<ParamListBase>) {
  const parent = nav.getParent();
  if (!parent) return;
  parent.dispatch(
    CommonActions.navigate({
      name: "Feed",
      params: { screen: "FeedMain" },
    }),
  );
}

/** Backward-compatible alias for previous naming. */
export function navigateToSearchTab(nav: NavigationProp<ParamListBase>) {
  navigateToFeedTab(nav);
}

export function navigateToCartMain(nav: NavigationProp<ParamListBase>) {
  const tabNav = findTabNavigator(nav);
  if (!tabNav) return;
  tabNav.dispatch(
    CommonActions.navigate({
      name: "Cart",
      params: { screen: "CartMain" },
    }),
  );
}

/** Resets Cart stack to inbox — for Messages tab re-tap only. */
export function resetCartStackToMain(nav: NavigationProp<ParamListBase>) {
  const cartStackNav = findCartStackNavigator(nav);
  if (cartStackNav) {
    const stackState = cartStackNav.getState();
    const atInbox = stackState.routes.length === 1 && stackState.routes[0]?.name === "CartMain";
    if (!atInbox) {
      cartStackNav.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "CartMain" }],
        }),
      );
    }
    return;
  }

  const tabNav = findTabNavigator(nav);
  if (!tabNav) return;
  resetNestedTabStack(tabNav, "Cart", "CartMain");
}

/** Cross-tab back from MessageThread opened on Feed PublicProfile. */
export function leaveMessageThreadToReturnTarget(
  nav: NavigationProp<ParamListBase>,
  returnTo: NavigationReturnTarget,
  programmaticPopRef?: MutableRefObject<boolean>,
) {
  if (nav.canGoBack()) {
    if (programmaticPopRef) programmaticPopRef.current = true;
    nav.goBack();
    if (programmaticPopRef) programmaticPopRef.current = false;
  }
  navigateToRootTabScreen(nav, returnTo);
}

export function navigateToSubscriptionPaywall(nav: NavigationProp<ParamListBase>) {
  nav.navigate("SubscriptionPaywall");
}

export function navigateToPublicProfile(
  nav: NavigationProp<ParamListBase>,
  userId: string,
  options?: NavigateToPublicProfileOptions,
) {
  const trimmed = userId.trim();
  if (!trimmed) return;

  const profileParams: PublicProfileRouteParams = { userId: trimmed };
  if (options?.returnTab) {
    profileParams.returnTab = options.returnTab;
    profileParams.returnScreen = options.returnScreen ?? TAB_MAIN_SCREEN[options.returnTab];
  }

  const routeNames = nav.getState()?.routeNames ?? [];

  // Messages tab: stay in Cart stack with push animation.
  if (routeNames.includes("CartMain")) {
    (nav as StackPushNav).push("PublicProfile", profileParams);
    return;
  }

  // Feed / Home / Bookings / Profile browse stacks.
  const browseStackMarkers = ["FeedMain", "HomeMain", "BookingsMain", "ProfileMain"] as const;
  if (browseStackMarkers.some((marker) => routeNames.includes(marker))) {
    (nav as StackPushNav).push("PublicProfile", profileParams);
    return;
  }

  const parent = nav.getParent();
  if (!parent) return;

  const hostTab = getCurrentRootTabName(nav);
  const browseTab: RootTabName = hostTab && hostTab !== "Cart" ? hostTab : "Feed";

  parent.dispatch(
    CommonActions.navigate({
      name: browseTab,
      params: {
        screen: "PublicProfile",
        params: profileParams,
      },
    }),
  );
}

export function navigateToMessageThread(
  nav: NavigationProp<ParamListBase>,
  params: MessageThreadRouteParams,
) {
  const { returnTo, ...threadParams } = params;

  // Cart or browse stack: native push + pop with swipe-back.
  if (isCartStackNavigation(nav) || isBrowseStackNavigation(nav)) {
    (nav as StackPushNav).push("MessageThread", threadParams);
    return;
  }

  const tabNav = findTabNavigator(nav);
  tabNav?.dispatch(
    CommonActions.navigate({
      name: "Cart",
      params: { screen: "MessageThread", params: returnTo ? params : threadParams },
    }),
  );
}

export function getTabMainScreen(tab: RootTabName): string {
  return TAB_MAIN_SCREEN[tab];
}
