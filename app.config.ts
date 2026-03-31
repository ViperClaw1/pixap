import type { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
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
    associatedDomains: ["applinks:Pixap.kz", "applinks:www.Pixap.kz"],
    infoPlist: {
      ...config.ios?.infoPlist,
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
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
    },
  },
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
      },
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
          { scheme: "https", host: "Pixap.kz", pathPrefix: "/" },
          { scheme: "https", host: "www.Pixap.kz", pathPrefix: "/" },
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
    oauthRedirectBase: process.env.EXPO_PUBLIC_OAUTH_REDIRECT_BASE ?? "https://Pixap.kz",
    /** Optional: override native OAuth redirect (default: Linking.createURL("~oauth/callback")) */
    oauthMobileRedirectUri: process.env.EXPO_PUBLIC_OAUTH_MOBILE_REDIRECT_URI,
    stripeReturnScheme: process.env.EXPO_PUBLIC_STRIPE_RETURN_SCHEME ?? "Pixap",
    googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
    },
  },
});
