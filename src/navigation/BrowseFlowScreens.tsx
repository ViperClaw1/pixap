import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { HomeStackParamList } from "./types";
import PlaceDetailScreen from "@/pages/place-detail";
import PlaceGalleryScreen from "@/pages/place-gallery";
import CategoryScreen from "@/pages/category";
import ShoppingItemsScreen from "@/pages/shopping-items";
import VibeMatchScreen from "@/pages/vibe-match";
import AddStoryFromPostScreen from "@/pages/add-story-from-post";
import StoryDiscussionScreen from "@/pages/story-discussion";
import SubscriptionPaywallScreen from "@/pages/subscription-paywall";

const fullWidthSwipeBackOptions = {
  gestureEnabled: true,
  fullScreenGestureEnabled: true,
} as const;

/** Галерея — полноэкранная модалка как раньше. */
const galleryModalOptions = { presentation: "fullScreenModal" as const };
/**
 * Сторис/композер: `transparentModal` оставляет предыдущий экран в дереве (`display: flex` в NativeStackView),
 * иначе под `fullScreenModal` подложка получает `display: none` и при закрытии модалки вся сетка размонтируется.
 */
const storyOverlayModalOptions = { presentation: "transparentModal" as const };

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
      <Screen name="PlaceGallery" component={PlaceGalleryScreen} options={galleryModalOptions} />
      <Screen
        name="StoryViewer"
        getComponent={() => require("@/pages/story-viewer").default}
        options={storyOverlayModalOptions}
      />
      <Screen
        name="FeedStoryViewer"
        getComponent={() => require("@/pages/feed-story-viewer").default}
        options={storyOverlayModalOptions}
      />
      <Screen
        name="StoryComposer"
        getComponent={() => require("@/pages/story-composer").default}
        options={storyOverlayModalOptions}
      />
      <Screen name="AddStoryFromPost" component={AddStoryFromPostScreen} options={storyOverlayModalOptions} />
      <Screen
        name="StoryDiscussion"
        component={StoryDiscussionScreen}
        options={{ presentation: "modal", animation: "slide_from_bottom", headerShown: false }}
      />
      <Screen name="Category" component={CategoryScreen} options={fullWidthSwipeBackOptions} />
      <Screen name="ShoppingItems" component={ShoppingItemsScreen} />
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
      <Screen name="VibeMatch" component={VibeMatchScreen} options={fullWidthSwipeBackOptions} />
      <Screen name="SubscriptionPaywall" component={SubscriptionPaywallScreen} options={fullWidthSwipeBackOptions} />
    </>
  );
}
