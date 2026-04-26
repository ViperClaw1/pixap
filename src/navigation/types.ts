import type { NavigatorScreenParams } from "@react-navigation/native";
import type {
  StoryComposerRouteParams,
  StoryDiscussionRouteParams,
  StoryViewerRouteParams,
} from "@/types/stories";

/** Shared routes for browse/detail flows (mounted on Home + Feed stacks). */
export type BrowseFlowParamList = {
  PlaceDetail: { id: string };
  StoryViewer: StoryViewerRouteParams;
  StoryComposer: StoryComposerRouteParams;
  StoryDiscussion: StoryDiscussionRouteParams;
  Category: { id: string };
  ShoppingItems: { id: string };
  BookingFlow: { id: string };
  AIBooking: { id?: string } | undefined;
  SubscriptionPaywall: undefined;
};

/** Home tab stack */
export type HomeStackParamList = {
  HomeMain: undefined;
  SearchMain: undefined;
  OAuthCallback: undefined;
} & BrowseFlowParamList;

/** Feed tab stack (same detail flows as Home for consistent `navigate` calls). */
export type FeedStackParamList = {
  FeedMain: undefined;
} & BrowseFlowParamList;

/** Legacy type kept for compatibility with existing SearchScreen typings. */
export type SearchStackParamList = {
  SearchMain: undefined;
} & BrowseFlowParamList;

export type CartStackParamList = {
  CartMain: undefined;
  PaymentSuccess: { next?: "bookings" } | undefined;
  PaymentCanceled: undefined;
};

export type BookingsStackParamList = {
  BookingsMain: undefined;
} & BrowseFlowParamList;

export type ProfileStackParamList = {
  ProfileMain: undefined;
  MyPurchases: undefined;
  Auth: undefined;
  ResetPassword: undefined;
  EditProfile: undefined;
  Favorites: undefined;
  Privacy: undefined;
  NotFound: undefined;
  AdminImageUpload: undefined;
  SubscriptionPaywall: undefined;
} & BrowseFlowParamList;

/** Root is bottom tabs — tab bar is always mounted. */
export type RootTabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList>;
  Feed: NavigatorScreenParams<FeedStackParamList>;
  Bookings: NavigatorScreenParams<BookingsStackParamList>;
  Cart: NavigatorScreenParams<CartStackParamList>;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootTabParamList {}
  }
}
