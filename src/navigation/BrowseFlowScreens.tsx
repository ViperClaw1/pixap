import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { HomeStackParamList } from "./types";
import PlaceDetailScreen from "@/pages/place-detail";
import PlaceGalleryScreen from "@/pages/place-gallery";
import CategoryScreen from "@/pages/category";
import ShoppingItemsScreen from "@/pages/shopping-items";
import BookingFlowScreen from "@/pages/booking-flow";
import AIBookingScreen from "@/pages/ai-booking";
import VibeMatchScreen from "@/pages/vibe-match";
import StoryViewerScreen from "@/pages/story-viewer";
import FeedStoryViewerScreen from "@/pages/feed-story-viewer";
import StoryComposerScreen from "@/pages/story-composer";
import AddStoryFromPostScreen from "@/pages/add-story-from-post";
import StoryDiscussionScreen from "@/pages/story-discussion";
import SubscriptionPaywallScreen from "@/pages/subscription-paywall";

const fullWidthSwipeBackOptions = {
  gestureEnabled: true,
  fullScreenGestureEnabled: true,
} as const;

const storyModalOptions = { presentation: "fullScreenModal" as const };

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
      <Screen name="PlaceDetail" component={PlaceDetailScreen} options={fullWidthSwipeBackOptions} />
      <Screen name="PlaceGallery" component={PlaceGalleryScreen} options={storyModalOptions} />
      <Screen name="StoryViewer" component={StoryViewerScreen} options={storyModalOptions} />
      <Screen name="FeedStoryViewer" component={FeedStoryViewerScreen} options={storyModalOptions} />
      <Screen name="StoryComposer" component={StoryComposerScreen} options={storyModalOptions} />
      <Screen name="AddStoryFromPost" component={AddStoryFromPostScreen} options={storyModalOptions} />
      <Screen
        name="StoryDiscussion"
        component={StoryDiscussionScreen}
        options={{ presentation: "modal", animation: "slide_from_bottom", headerShown: false }}
      />
      <Screen name="Category" component={CategoryScreen} options={fullWidthSwipeBackOptions} />
      <Screen name="ShoppingItems" component={ShoppingItemsScreen} />
      <Screen name="BookingFlow" component={BookingFlowScreen} options={fullWidthSwipeBackOptions} />
      <Screen name="AIBooking" component={AIBookingScreen} options={fullWidthSwipeBackOptions} />
      <Screen name="VibeMatch" component={VibeMatchScreen} options={fullWidthSwipeBackOptions} />
      <Screen name="SubscriptionPaywall" component={SubscriptionPaywallScreen} options={fullWidthSwipeBackOptions} />
    </>
  );
}
