import { AppState, Linking, Platform } from "react-native";
import Constants from "expo-constants";
import * as StoreReview from "expo-store-review";
import { devLog, devWarn } from "@/shared/lib/devLog";
import { APP_STORE_REVIEW_SCENE_SETTLE_MS, PIXAP_APP_STORE_URL } from "./constants";
import { isProductionAppStoreReviewRuntime } from "./isProductionAppStoreReviewRuntime";

const MAX_SCENE_RETRIES = 3;
const RETRY_DELAY_MS = 600;
/** SKStoreReviewController JS promise may never resolve; don't await longer than this. */
const NATIVE_INVOKE_MAX_WAIT_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function resolveAppStoreUrl(): string {
  const extraUrl = (Constants.expoConfig?.extra as { appStoreUrl?: string } | undefined)?.appStoreUrl;
  return StoreReview.storeUrl() ?? extraUrl ?? PIXAP_APP_STORE_URL;
}

/**
 * Fire-and-forget with a short cap: native review sheet is shown asynchronously and the
 * Expo promise often never settles even when the call succeeded.
 */
async function invokeNativeRequestReview(): Promise<boolean> {
  try {
    const pending = StoreReview.requestReview();
    await Promise.race([pending, sleep(NATIVE_INVOKE_MAX_WAIT_MS)]);
    if (__DEV__) devLog("[app-store-review] requestReview() invoked (native available)");
    return true;
  } catch (error) {
    if (__DEV__) devWarn("[app-store-review] requestReview failed", error);
    return false;
  }
}

async function attemptRequestReview(): Promise<boolean> {
  if (AppState.currentState !== "active") return false;

  try {
    if (await StoreReview.isAvailableAsync()) {
      return invokeNativeRequestReview();
    }

    if (!isProductionAppStoreReviewRuntime()) {
      const storeUrl = resolveAppStoreUrl();
      if (await Linking.canOpenURL(storeUrl)) {
        await Linking.openURL(storeUrl);
        if (__DEV__) devLog("[app-store-review] opened App Store URL fallback");
        return true;
      }
    }

    if (await StoreReview.hasAction()) {
      return invokeNativeRequestReview();
    }

    if (__DEV__) {
      devWarn("[app-store-review] no native review action and no store URL available");
    }
    return false;
  } catch (error) {
    if (__DEV__) {
      devWarn("[app-store-review] requestReview failed", error);
    }
    return false;
  }
}

export async function requestAppStoreReview(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;

  await sleep(APP_STORE_REVIEW_SCENE_SETTLE_MS);

  for (let attempt = 0; attempt < MAX_SCENE_RETRIES; attempt += 1) {
    if (AppState.currentState !== "active") return false;
    if (await attemptRequestReview()) return true;
    if (attempt < MAX_SCENE_RETRIES - 1) {
      await sleep(RETRY_DELAY_MS);
    }
  }

  return false;
}
