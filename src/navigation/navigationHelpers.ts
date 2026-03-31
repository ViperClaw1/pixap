import { CommonActions, type NavigationProp, type ParamListBase } from "@react-navigation/native";

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

export function navigateToSearchTab(nav: NavigationProp<ParamListBase>) {
  const parent = nav.getParent();
  if (!parent) return;
  parent.dispatch(
    CommonActions.navigate({
      name: "Search",
      params: { screen: "SearchMain" },
    }),
  );
}

export function navigateToCartMain(nav: NavigationProp<ParamListBase>) {
  const parent = nav.getParent();
  if (!parent) return;
  parent.dispatch(
    CommonActions.navigate({
      name: "Cart",
      params: { screen: "CartMain" },
    }),
  );
}
