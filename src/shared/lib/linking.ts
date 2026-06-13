import * as Linking from "expo-linking";
import { env } from "./env";

const httpsPrefixes = ["https://pixapp.kz", "https://www.pixapp.kz"] as const;
const schemePrefix = `${env.stripeReturnScheme}://`;

export const linkingPrefixes = [...httpsPrefixes, schemePrefix, Linking.createURL("/")];

/** e.g. pixapp://payment-success — matched in app `getStateFromPath` → Cart/PaymentSuccess */
export const stripeSuccessUrl = () => `${schemePrefix}payment-success`;
export const stripeCancelUrl = () => `${schemePrefix}payment-canceled`;

/**
 * Nested config for root bottom tabs (`RootTabParamList`).
 * Stripe return URLs use root path `payment-success` / `payment-canceled` (see app/navigation/linking.ts).
 */
export const linkingConfig = {
  screens: {
    Home: {
      path: "",
      screens: {
        HomeMain: "",
        DailyRecommendations: "daily-recommendations",
        PlaceDetail: "place/:id",
        Category: "category/:id",
        ShoppingItems: "shop/:id",
        BookingFlow: "book/:id",
        AIBooking: "pixai",
        VibeMatch: "vibe-match",
        FeedStoryViewer: "story/:storyId",
        OAuthCallback: "~oauth/callback",
      },
    },
    Feed: {
      path: "feed",
      screens: {
        FeedMain: "",
        FeedStoryViewer: "story/:storyId",
        PlaceDetail: "place/:id",
        Category: "category/:id",
        ShoppingItems: "shop/:id",
        BookingFlow: "book/:id",
        AIBooking: "pixai",
        VibeMatch: "vibe-match",
      },
    },
    Cart: {
      path: "cart",
      screens: {
        CartMain: "",
        PaymentSuccess: {
          path: "payment-success",
          parse: {
            next: (value: string | undefined) => (value === "bookings" ? value : undefined),
          },
        },
        PaymentCanceled: "payment-canceled",
      },
    },
    Bookings: {
      path: "bookings",
      screens: {
        BookingsMain: "",
        BookingDetail: ":bookingId",
        PlaceDetail: "booking-place/:id",
        AIBooking: "pixai",
        VibeMatch: "vibe-match",
      },
    },
    Profile: {
      path: "profile",
      screens: {
        ProfileMain: "",
        Auth: "auth",
        AuthEmailSent: "auth-email-sent",
        AuthEmailCallback: "auth-email-callback",
        ResetPassword: "reset-password",
        PasswordResetSent: "password-reset-sent",
        EditProfile: "edit",
        Favorites: "favorites",
        Privacy: "privacy",
        NotFound: "*",
        AdminImageUpload: "partner-upload",
        AIBooking: "pixai",
        VibeMatch: "vibe-match",
      },
    },
  },
} as const;
