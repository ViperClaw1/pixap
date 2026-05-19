import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { fetchStoryViewerContext } from "@/entities/story/lib/fetchStoryViewerContext";
import type { BrowseFlowParamList, RootTabParamList } from "./types";

type AppNavigation = NavigationProp<Record<string, object | undefined>>;

function rootTabNavigation(navigation: AppNavigation): NavigationProp<RootTabParamList> {
  const parent = navigation.getParent() as NavigationProp<RootTabParamList> | undefined;
  return parent ?? (navigation as NavigationProp<RootTabParamList>);
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

  const feedNav = rootTabNavigation(navigation);
  feedNav.navigate("Feed", {
    screen: "FeedStoryViewer",
    params: {
      groups: context.groups,
      initialGroupIndex: context.initialGroupIndex,
      initialStoryIndex: context.initialStoryIndex,
      placeId: context.placeId,
    },
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
