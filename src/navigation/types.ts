import type { NavigatorScreenParams } from "@react-navigation/native";

/** Shared routes for browse/detail flows (mounted on Home + Search stacks). */
export type BrowseFlowParamList = {
  PlaceDetail: { id: string };
  Category: { id: string };
  ShoppingItems: { id: string };
  BookingFlow: { id: string };
  AIBooking: { id?: string } | undefined;
};

/** Home tab stack */
export type HomeStackParamList = {
  HomeMain: undefined;
  OAuthCallback: undefined;
} & BrowseFlowParamList;

/** Search tab stack (same detail flows as Home for consistent `navigate` calls). */
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
} & BrowseFlowParamList;

/** Root is bottom tabs — tab bar is always mounted. */
export type RootTabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList>;
  Search: NavigatorScreenParams<SearchStackParamList>;
  Cart: NavigatorScreenParams<CartStackParamList>;
  Bookings: NavigatorScreenParams<BookingsStackParamList>;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootTabParamList {}
  }
}
