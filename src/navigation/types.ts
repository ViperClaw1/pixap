import type { NavigatorScreenParams } from "@react-navigation/native";
import type {
  AddStoryFromPostRouteParams,
  StoryComposerRouteParams,
  StoryDiscussionRouteParams,
  StoryViewerRouteParams,
} from "@/types/stories";

/** Shared routes for browse/detail flows (mounted on Home + Feed stacks). */
export type BrowseFlowParamList = {
  PlaceDetail: { id: string };
  PlaceGallery: { images: string[]; rawImages?: string[]; initialIndex?: number };
  StoryViewer: StoryViewerRouteParams;
  FeedStoryViewer: StoryViewerRouteParams;
  StoryComposer: StoryComposerRouteParams;
  AddStoryFromPost: AddStoryFromPostRouteParams;
  StoryDiscussion: StoryDiscussionRouteParams;
  Category: { id: string };
  ShoppingItems: { id: string };
  BookingFlow: { id: string };
  AIBooking: { id?: string } | undefined;
  VibeMatch: undefined;
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
  FeedMain:
    | {
        focusPostId?: string;
        focusStoryId?: string;
        filterUserId?: string;
        postsScope?: "all" | "mine";
      }
    | undefined;
} & BrowseFlowParamList;

/** Legacy type kept for compatibility with existing SearchScreen typings. */
export type SearchStackParamList = {
  SearchMain: undefined;
} & BrowseFlowParamList;

export type CartStackParamList = {
  CartMain: undefined;
  MessageThread: {
    threadId: string;
    peerId: string;
    peerFirstName?: string | null;
    peerLastName?: string | null;
    peerAvatarUrl?: string | null;
    initialDraft?: string;
  };
  PaymentSuccess: { next?: "bookings" } | undefined;
  PaymentCanceled: undefined;
};

export type BookingsStackParamList = {
  BookingsMain: undefined;
} & BrowseFlowParamList;

export type ProfileStackParamList = {
  ProfileMain:
    | {
        openCreateStep?: "post" | "story";
        openCreateModal?: boolean;
      }
    | undefined;
  MyPurchases: undefined;
  Auth: undefined;
  AuthEmailSent: { email: string } | undefined;
  AuthEmailCallback: { href?: string } | undefined;
  VerifyEmailOtp:
    | {
        flow?: "verify" | "recovery";
        email?: string;
      }
    | undefined;
  ResetPassword: undefined;
  PasswordResetSent: { email: string } | undefined;
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
