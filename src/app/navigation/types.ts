import type { NavigatorScreenParams } from "@react-navigation/native";
import type {
  AddStoryFromPostRouteParams,
  StoryComposerRouteParams,
  StoryDiscussionRouteParams,
  StoryViewerRouteParams,
} from "@/shared/model/types/stories";
import type { PostDiscussionRouteParams } from "@/shared/model/types/postDiscussion";

export type RootTabName = "Home" | "Feed" | "Bookings" | "Cart" | "Profile";

/** Cross-tab return target (e.g. MessageThread → PublicProfile). */
export type NavigationReturnTarget = {
  tab: RootTabName;
  screen: string;
  params?: Record<string, unknown>;
};

export type PublicProfileRouteParams = {
  userId: string;
  /** When opened from another tab (e.g. Cart), back returns here instead of the browse stack root. */
  returnTab?: RootTabName;
  returnScreen?: string;
};

export type MessageThreadRouteParams = {
  /** Empty string — thread is resolved from `peerId` on screen mount. */
  threadId: string;
  peerId: string;
  peerFirstName?: string | null;
  peerLastName?: string | null;
  peerAvatarUrl?: string | null;
  initialDraft?: string;
  isSupport?: boolean;
  threadTitle?: string;
  /** Legacy Cart-only cross-tab back; unused when MessageThread lives in the browse stack. */
  returnTo?: NavigationReturnTarget;
};

/** Shared routes for browse/detail flows (mounted on Home + Feed stacks). */
export type BrowseFlowParamList = {
  PostDetail: { postId: string };
  PlaceDetail: { id: string; hideBookingActions?: boolean };
  PlacePhotoGrid: { placeId: string; title: string; images: string[]; rawImages?: string[] };
  PlaceGallery: { placeId: string; images: string[]; rawImages?: string[]; initialIndex?: number };
  StoryViewer: StoryViewerRouteParams;
  FeedStoryViewer: StoryViewerRouteParams;
  StoryComposer: StoryComposerRouteParams;
  AddStoryFromPost: AddStoryFromPostRouteParams;
  StoryDiscussion: StoryDiscussionRouteParams;
  PostDiscussion: PostDiscussionRouteParams;
  Category: { id: string };
  ShoppingItems: { id: string };
  BookingFlow: { id: string };
  AIBooking: { id?: string } | undefined;
  VibeMatch: undefined;
  SubscriptionPaywall: { reason?: "no_credits" | "upgrade" } | undefined;
  EditProfile: undefined;
  PublicProfile: PublicProfileRouteParams;
  MessageThread: MessageThreadRouteParams;
};

/** Home tab stack */
export type HomeStackParamList = {
  HomeMain: undefined;
  SearchMain: undefined;
  DailyRecommendations:
    | {
        date?: string;
      }
    | undefined;
  OAuthCallback: undefined;
} & BrowseFlowParamList;

/** Feed tab stack (same detail flows as Home for consistent `navigate` calls). */
export type FeedStackParamList = {
  FeedMain:
    | {
        focusPostId?: string;
        focusStoryId?: string;
        filterUserId?: string;
      }
    | undefined;
} & BrowseFlowParamList;

/** Legacy type kept for compatibility with existing SearchScreen typings. */
export type SearchStackParamList = {
  SearchMain: undefined;
} & BrowseFlowParamList;

export type CartStackParamList = {
  CartMain: undefined;
  PublicProfile: PublicProfileRouteParams;
  MessageThread: MessageThreadRouteParams;
  FeedStoryViewer: StoryViewerRouteParams;
  PaymentSuccess: { next?: "bookings" } | undefined;
  PaymentCanceled: undefined;
};

export type BookingsStackParamList = {
  BookingsMain: undefined;
  BookingDetail: { bookingId: string };
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
  PreferenceOnboarding:
    | {
        source?: "gate" | "profile" | "edit_profile";
        retake?: boolean;
      }
    | undefined;
  Favorites: undefined;
  Privacy: undefined;
  NotFound: undefined;
  AdminImageUpload: undefined;
  AdminDashboard: undefined;
  AdminModeration: undefined;
  SubscriptionPaywall: { reason?: "no_credits" | "upgrade" } | undefined;
} & BrowseFlowParamList;
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
