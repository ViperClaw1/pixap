import * as Linking from "expo-linking";
import { env } from "./env";

const httpsPrefixes = ["https://pixapp.kz", "https://www.pixapp.kz"] as const;
const schemePrefix = `${env.stripeReturnScheme}://`;

export const linkingPrefixes = [...httpsPrefixes, schemePrefix, Linking.createURL("/")];

/** e.g. pixapp://payment-success — matched in navigation `getStateFromPath` → Cart/PaymentSuccess */
export const stripeSuccessUrl = () => `${schemePrefix}payment-success`;
export const stripeCancelUrl = () => `${schemePrefix}payment-canceled`;

/**
 * Nested config for root bottom tabs (`RootTabParamList`).
 * Stripe return URLs use root path `payment-success` / `payment-canceled` (see navigation/linking.ts).
 */
export const linkingConfig = {
  screens: {
    Home: {
      path: "",
      screens: {
        HomeMain: "",
        PlaceDetail: "place/:id",
        Category: "category/:id",
        ShoppingItems: "shop/:id",
        BookingFlow: "book/:id",
        AIBooking: "pixai",
        OAuthCallback: "~oauth/callback",
      },
    },
    Search: {
      path: "search",
      screens: {
        SearchMain: "",
        PlaceDetail: "place/:id",
        Category: "category/:id",
        ShoppingItems: "shop/:id",
        BookingFlow: "book/:id",
        AIBooking: "pixai",
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
        PlaceDetail: "booking-place/:id",
        AIBooking: "pixai",
      },
    },
    Profile: {
      path: "profile",
      screens: {
        ProfileMain: "",
        Auth: "auth",
        ResetPassword: "reset-password",
        EditProfile: "edit",
        Favorites: "favorites",
        Privacy: "privacy",
        NotFound: "*",
        AdminImageUpload: "partner-upload",
        AIBooking: "pixai",
      },
    },
  },
} as const;
