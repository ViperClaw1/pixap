import type { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  const googleMapsWebApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY?.trim();
  const oauthMobileRedirectUri = process.env.EXPO_PUBLIC_OAUTH_MOBILE_REDIRECT_URI?.trim();
  const appVersion = process.env.APP_VERSION?.trim() ?? config.version ?? "1.0.0";
  const iosBuildNumber = process.env.IOS_BUILD_NUMBER?.trim() ?? config.ios?.buildNumber ?? "22";
  const androidVersionCodeRaw = process.env.ANDROID_VERSION_CODE?.trim() ?? String(config.android?.versionCode ?? "22");
  const androidVersionCode = Number.parseInt(androidVersionCodeRaw, 10);
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
  version: appVersion,
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  ios: {
    ...config.ios,
    buildNumber: iosBuildNumber,
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
    versionCode: Number.isFinite(androidVersionCode) && androidVersionCode > 0 ? androidVersionCode : 12,
    config: {
      ...config.android?.config,
      ...googleMapsConfig,
    },
    package: "com.pixap.pixap",
    adaptiveIcon: {
      backgroundColor: "#ffffff",
      foregroundImage: "./assets/icon.png",
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
    [
      "expo-splash-screen",
      {
        backgroundColor: "#ffffff",
        image: "./assets/splash-icon.png",
        /** Default plugin value is 100pt — too small; center logo readable on phones. */
        imageWidth: 300,
        resizeMode: "contain",
        /** Full-screen splash image on iOS (required for portrait artwork vs icon-only launch). */
        enableFullScreenImage_legacy: true,
        android: {
          backgroundColor: "#ffffff",
          image: "./assets/splash-icon.png",
          imageWidth: 300,
          resizeMode: "contain",
        },
        ios: {
          backgroundColor: "#ffffff",
          image: "./assets/splash-icon.png",
          resizeMode: "contain",
        },
      },
    ],
    "expo-font",
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
    googleMapsWebApiKey,
    pixAiMonthlySubscriptionSku: process.env.EXPO_PUBLIC_PIXAI_MONTHLY_SUBSCRIPTION_SKU ?? "pixai_premium_monthly",
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? "b98667c5-ca9d-4d17-8620-71f832f3befb",
    },
  },
  });
};
