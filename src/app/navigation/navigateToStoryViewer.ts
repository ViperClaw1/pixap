import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { fetchStoryViewerContext } from "@/entities/story/lib/fetchStoryViewerContext";
import type { StoryViewerRouteParams } from "@/shared/model/types/stories";
import type { BrowseFlowParamList, RootTabParamList } from "./types";

type AppNavigation = NavigationProp<Record<string, object | undefined>>;

type FeedStoryStackNav = NavigationProp<{ FeedStoryViewer: StoryViewerRouteParams }>;

function rootTabNavigation(navigation: AppNavigation): NavigationProp<RootTabParamList> {
  const parent = navigation.getParent() as NavigationProp<RootTabParamList> | undefined;
  return parent ?? (navigation as NavigationProp<RootTabParamList>);
}

/** Prefer the current stack (e.g. Messages/Cart) so dismiss returns to the thread, not Feed tab. */
function findNavigatorWithFeedStoryViewer(navigation: AppNavigation): FeedStoryStackNav | null {
  let current: AppNavigation | undefined = navigation;
  while (current) {
    const routeNames = (current.getState() as { routeNames?: string[] }).routeNames;
    if (routeNames?.includes("FeedStoryViewer")) {
      return current as FeedStoryStackNav;
    }
    current = current.getParent() as AppNavigation | undefined;
  }
  return null;
}

type FeedStoryNav = NavigationProp<BrowseFlowParamList, "FeedStoryViewer">;

/**
 * Opens FeedStoryViewer for a story id (in-app links, DMs, deep links).
 */
export async function navigateToFeedStoryViewer(
  navigation: AppNavigation,
  storyId: string,
  viewerUserId: string | null,
): Promise<boolean> {
  const context = await fetchStoryViewerContext(storyId, viewerUserId);
  if (!context) return false;

  const params: StoryViewerRouteParams = {
    groups: context.groups,
    initialGroupIndex: context.initialGroupIndex,
    initialStoryIndex: context.initialStoryIndex,
    placeId: context.placeId,
  };

  const stackNav = findNavigatorWithFeedStoryViewer(navigation);
  if (stackNav) {
    stackNav.navigate("FeedStoryViewer", params);
    return true;
  }

  const feedNav = rootTabNavigation(navigation);
  feedNav.navigate("Feed", {
    screen: "FeedStoryViewer",
    params,
  });
  return true;
}

/** Navigate from a screen that is already on the Feed stack. */
export async function navigateFeedStackStoryViewer(
  navigation: FeedStoryNav,
  storyId: string,
  viewerUserId: string | null,
): Promise<boolean> {
  const context = await fetchStoryViewerContext(storyId, viewerUserId);
  if (!context) return false;

  navigation.navigate("FeedStoryViewer", {
    groups: context.groups,
    initialGroupIndex: context.initialGroupIndex,
    initialStoryIndex: context.initialStoryIndex,
    placeId: context.placeId,
  });
  return true;
}
