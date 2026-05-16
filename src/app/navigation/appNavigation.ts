import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import type { RootTabParamList } from "./types";

/**
 * Any in-app navigator (stack/tab). Prefer cross-tab helpers below over casting at call sites.
 */
export type AppNavigation = NavigationProp<Record<string, object | undefined>>;

function rootTabNavigation(navigation: AppNavigation): NavigationProp<RootTabParamList> {
  const parent = navigation.getParent() as NavigationProp<RootTabParamList> | undefined;
  return parent ?? (navigation as NavigationProp<RootTabParamList>);
}

export function navigateFeedPlaceDetail(navigation: AppNavigation, placeId: string): void {
  rootTabNavigation(navigation).navigate("Feed", { screen: "PlaceDetail", params: { id: placeId } });
}

export function navigateFeedFocusStory(navigation: AppNavigation, storyId: string): void {
  rootTabNavigation(navigation).navigate("Feed", { screen: "FeedMain", params: { focusStoryId: storyId } });
}

/** Profile → Auth and similar flows that expect a generic navigation handle. */
export function asParamListNavigation(navigation: AppNavigation): NavigationProp<ParamListBase> {
  return navigation as NavigationProp<ParamListBase>;
}
