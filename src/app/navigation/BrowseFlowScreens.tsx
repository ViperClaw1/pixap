import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { HomeStackParamList } from "./types";
import {
  nativeStackModalFromBottomScreenOptions,
  nativeStackStoryOverlayModalOptions,
} from "./stackTransitionOptions";

const fullWidthSwipeBackOptions = {
  gestureEnabled: true,
  fullScreenGestureEnabled: true,
} as const;

/** Галерея — полноэкранная модалка как раньше. */
const galleryModalOptions = {
  presentation: "fullScreenModal" as const,
  freezeOnBlur: false as const,
};
/**
 * `Screen` prop type for stacks that include browse routes.
 * Uses `HomeStackParamList` as a wide-enough superset for JSX `name`/`component` props.
 */
const _browseScreenTypeHost = createNativeStackNavigator<HomeStackParamList>();
export type BrowseFlowStackScreen = (typeof _browseScreenTypeHost)["Screen"];

/**
 * Returns a Fragment of shared screens — use as `{renderBrowseFlowScreens(Stack.Screen)}` inside a Navigator.
 * Do not wrap in a custom component: React Navigation only allows Screen, Group, or Fragment as direct children.
 */
export function renderBrowseFlowScreens(Screen: BrowseFlowStackScreen) {
  return (
    <>
      <Screen
        name="PostDetail"
        getComponent={() => require("@/pages/post-detail").default}
        options={fullWidthSwipeBackOptions}
      />
      <Screen
        name="PlaceDetail"
        getComponent={() => require("@/pages/place-detail").default}
        options={fullWidthSwipeBackOptions}
      />
      <Screen
        name="PlaceGallery"
        getComponent={() => require("@/pages/place-gallery").default}
        options={galleryModalOptions}
      />
      <Screen
        name="StoryViewer"
        getComponent={() => require("@/pages/story-viewer").default}
        options={nativeStackStoryOverlayModalOptions}
      />
      <Screen
        name="FeedStoryViewer"
        getComponent={() => require("@/pages/feed-story-viewer").default}
        options={nativeStackStoryOverlayModalOptions}
      />
      <Screen
        name="StoryComposer"
        getComponent={() => require("@/pages/story-composer").default}
        options={nativeStackStoryOverlayModalOptions}
      />
      <Screen
        name="AddStoryFromPost"
        getComponent={() => require("@/pages/add-story-from-post").default}
        options={nativeStackStoryOverlayModalOptions}
      />
      <Screen
        name="StoryDiscussion"
        getComponent={() => require("@/pages/story-discussion").default}
        options={nativeStackModalFromBottomScreenOptions}
      />
      <Screen
        name="PostDiscussion"
        getComponent={() => require("@/pages/post-discussion").default}
        options={nativeStackModalFromBottomScreenOptions}
      />
      <Screen
        name="Category"
        getComponent={() => require("@/pages/category").default}
        options={fullWidthSwipeBackOptions}
      />
      <Screen name="ShoppingItems" getComponent={() => require("@/pages/shopping-items").default} options={fullWidthSwipeBackOptions} />
      <Screen
        name="BookingFlow"
        getComponent={() => require("@/pages/booking-flow").default}
        options={fullWidthSwipeBackOptions}
      />
      <Screen
        name="AIBooking"
        getComponent={() => require("@/pages/ai-booking").default}
        options={fullWidthSwipeBackOptions}
      />
      <Screen name="VibeMatch" getComponent={() => require("@/pages/vibe-match").default} options={fullWidthSwipeBackOptions} />
      <Screen
        name="SubscriptionPaywall"
        getComponent={() => require("@/pages/subscription-paywall").default}
        options={fullWidthSwipeBackOptions}
      />
    </>
  );
}
