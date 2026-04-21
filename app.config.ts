import type { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  const oauthMobileRedirectUri = process.env.EXPO_PUBLIC_OAUTH_MOBILE_REDIRECT_URI?.trim();
  const nativeOAuthRedirectUri =
    oauthMobileRedirectUri && !oauthMobileRedirectUri.startsWith("exp://") ? oauthMobileRedirectUri : undefined;
  const googleMapsConfig = googleMapsApiKey
    ? {
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      }
    : undefined;

  return ({
  ...config,
  name: "Pixap",
  slug: "pixap",
  scheme: "pixap",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#1a0a2e",
  },
  ios: {
    ...config.ios,
    supportsTablet: true,
    bundleIdentifier: "com.pixap.pixap",
    associatedDomains: ["applinks:pixapp.kz", "applinks:www.pixapp.kz"],
    infoPlist: {
      ...config.ios?.infoPlist,
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription:
        "Pixap uses the camera when you upload images for partner business listings (admin).",
      NSPhotoLibraryUsageDescription:
        "Pixap accesses your photo library when you choose images to upload for partner listings.",
      NSLocationWhenInUseUsageDescription:
        "Pixap uses your location to show directions from you to this place on the map.",
      UIBackgroundModes: ["remote-notification"],
    },
    config: {
      ...config.ios?.config,
      ...(googleMapsApiKey ? { googleMapsApiKey } : {}),
    },
  },
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      ...googleMapsConfig,
    },
    package: "com.pixap.pixap",
    adaptiveIcon: {
      backgroundColor: "#1a0a2e",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          { scheme: "https", host: "pixapp.kz", pathPrefix: "/" },
          { scheme: "https", host: "www.pixapp.kz", pathPrefix: "/" },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  plugins: [
    "expo-apple-authentication",
    "expo-web-browser",
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Pixap uses your location to show directions from you to this place on the map.",
      },
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/icon.png",
        color: "#ffffff",
        sounds: [],
      },
    ],
  ],
  extra: {
    ...config.extra,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    oauthRedirectBase: process.env.EXPO_PUBLIC_OAUTH_REDIRECT_BASE ?? "https://pixapp.kz",
    /** Optional: override native OAuth redirect (default: Linking.createURL("~oauth/callback")); exp:// ignored */
    oauthMobileRedirectUri: nativeOAuthRedirectUri,
    stripeReturnScheme: (process.env.EXPO_PUBLIC_STRIPE_RETURN_SCHEME ?? "pixap").toLowerCase(),
    googleMapsApiKey,
    pixappApiUrl: process.env.EXPO_PUBLIC_PIXAPP_API_URL,
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? "b98667c5-ca9d-4d17-8620-71f832f3befb",
    },
  },
  });
};
