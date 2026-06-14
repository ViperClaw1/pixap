/** Cumulative foreground usage before requesting a native store review. */
export const APP_STORE_REVIEW_USAGE_THRESHOLD_MS = __DEV__ ? 60_000 : 3 * 60 * 1000;

/** Fallback when `Constants.expoConfig.ios.appStoreUrl` is unavailable (e.g. Expo Go shell). */
export const PIXAP_APP_STORE_URL = "https://apps.apple.com/app/pixap/id6760616898";

/** Fallback when `Constants.expoConfig.android.playStoreUrl` is unavailable. */
export const PIXAP_PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.pixap.pixap";

/** Min interval before re-prompting on Android production (Google Play guideline ~90 days). */
export const STORE_REVIEW_ANDROID_RETRY_MS = 90 * 86_400_000;

/** Min gap between native review attempts in dev / Expo Go (Apple silently ignores rapid repeats). */
export const APP_STORE_REVIEW_DEV_RETRY_MS = 60_000;

/** Wait after NavigationContainer.onReady — SKStoreReviewController won't show during splash transition. */
export const APP_STORE_REVIEW_POST_NAV_SETTLE_MS = 3_000;

/** Min continuous foreground time in the current session before prompting. */
export const APP_STORE_REVIEW_MIN_SESSION_MS = __DEV__ ? 45_000 : 30_000;

/** Short delay before each native invoke so UIWindowScene is stable. */
export const APP_STORE_REVIEW_SCENE_SETTLE_MS = 800;
