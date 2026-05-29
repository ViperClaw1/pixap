import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { HomeStackParamList } from "./types";

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
 * Сторис/композер: `transparentModal` оставляет предыдущий экран в дереве (`display: flex` в NativeStackView),
 * иначе под `fullScreenModal` подложка получает `display: none` и при закрытии модалки вся сетка размонтируется.
 * `freezeOnBlur: false` — не замирают таймеры/прогресс под модалкой.
 */
const storyOverlayModalOptions = {
  presentation: "transparentModal" as const,
  freezeOnBlur: false as const,
  /** Custom pan dismiss in StoryViewer / FeedStoryViewer — native swipe conflicts with JS translateY. */
  gestureEnabled: false,
  animation: "fade" as const,
  contentStyle: { backgroundColor: "transparent" },
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
      <Screen
        name="AddStoryFromPost"
        getComponent={() => require("@/pages/add-story-from-post").default}
        options={storyOverlayModalOptions}
      />
      <Screen
        name="StoryDiscussion"
        getComponent={() => require("@/pages/story-discussion").default}
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
          headerShown: false,
          freezeOnBlur: false,
        }}
      />
      <Screen
        name="PostDiscussion"
        getComponent={() => require("@/pages/post-discussion").default}
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
          headerShown: false,
          freezeOnBlur: false,
        }}
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
      <Screen
        name="PublicProfile"
        getComponent={() => require("@/pages/public-profile").default}
        options={fullWidthSwipeBackOptions}
      />
      <Screen
        name="MessageThread"
        getComponent={() => require("@/pages/message-thread").default}
        options={fullWidthSwipeBackOptions}
      />
    </>
  );
}
