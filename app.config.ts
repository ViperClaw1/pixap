import type { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  const googleMapsWebApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY?.trim();
  const googleMapsAndroidCertSha1 = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_CERT_SHA1?.replace(/:/g, "").trim();
  const oauthMobileRedirectUri = process.env.EXPO_PUBLIC_OAUTH_MOBILE_REDIRECT_URI?.trim();
  const appVersion = process.env.APP_VERSION?.trim() ?? config.version ?? "1.0.0";
  const iosBuildNumber = process.env.IOS_BUILD_NUMBER?.trim() ?? config.ios?.buildNumber ?? "32";
  const androidVersionCodeRaw = process.env.ANDROID_VERSION_CODE?.trim() ?? String(config.android?.versionCode ?? "32");
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
  /** iOS App Store / home screen; Android launcher uses `android.adaptiveIcon`. */
  icon: "./assets/ios/icon.png",
  userInterfaceStyle: "automatic",
  splash: {
    image: "./assets/ios/splash.png",
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
        "Pixap uses your location to show directions to venues and to check you in at nearby places for the Live Crowd feature.",
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
    softwareKeyboardLayoutMode: "pan",
    adaptiveIcon: {
      backgroundColor: "#ffffff",
      foregroundImage: "./assets/android/adaptive-icon-foreground.png",
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
      {
        action: "VIEW",
        data: [{ scheme: "pixap", pathPrefix: "/post" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  newArchEnabled: true,
  plugins: [
    [
      "expo-build-properties",
      {
        android: {
          targetSdkVersion: 35,
          compileSdkVersion: 35,
          enableProguardInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
        },
      },
    ],
    [
      "expo-splash-screen",
      {
        backgroundColor: "#ffffff",
        image: "./assets/android/splash.png",
        imageWidth: 300,
        resizeMode: "contain",
        enableFullScreenImage_legacy: true,
        android: {
          backgroundColor: "#ffffff",
          image: "./assets/android/splash.png",
          imageWidth: 300,
          resizeMode: "contain",
        },
        ios: {
          backgroundColor: "#ffffff",
          image: "./assets/ios/splash.png",
          resizeMode: "contain",
        },
      },
    ],
    [
      "expo-font",
      {
        fonts: [
          "./node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf",
          "./node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome.ttf",
          "./node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome6_Solid.ttf",
          "./node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome6_Brands.ttf",
          "./node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome5_Solid.ttf",
          "./node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Fontisto.ttf",
          "./node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Entypo.ttf",
        ],
      },
    ],
    "expo-localization",
    "expo-apple-authentication",
    "expo-web-browser",
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Pixap uses your location to show directions to venues and to check you in at nearby places for the Live Crowd feature.",
      },
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/android/notification-icon.png",
        color: "#ffffff",
        sounds: [],
      },
    ],
    "expo-video",
    [
      "expo-speech-recognition",
      {
        microphonePermission:
          "Pixap uses the microphone so you can dictate messages in chat.",
        speechRecognitionPermission:
          "Pixap uses speech recognition to convert your voice into text in chat.",
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
    googleMapsAndroidCertSha1:
      googleMapsAndroidCertSha1 && /^[0-9a-fA-F]{40}$/.test(googleMapsAndroidCertSha1)
        ? googleMapsAndroidCertSha1.toUpperCase()
        : undefined,
    pixAiMonthlySubscriptionSku: process.env.EXPO_PUBLIC_PIXAI_MONTHLY_SUBSCRIPTION_SKU ?? "pixai_premium_monthly",
    pixAiAnnualSubscriptionSku: process.env.EXPO_PUBLIC_PIXAI_ANNUAL_SUBSCRIPTION_SKU ?? "pixai_premium_annual",
    /** Pass through for runtime checks; enable transforms in Supabase Dashboard first. */
    supabaseImageTransformEnabled:
      process.env.EXPO_PUBLIC_SUPABASE_IMAGE_TRANSFORM === "1" ||
      process.env.EXPO_PUBLIC_SUPABASE_IMAGE_TRANSFORM === "true",
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? "b98667c5-ca9d-4d17-8620-71f832f3befb",
    },
  },
  });
};
