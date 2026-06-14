import { AppState, Linking, Platform } from "react-native";
import Constants from "expo-constants";
import * as StoreReview from "expo-store-review";
import { devLog, devWarn } from "@/shared/lib/devLog";
import {
  APP_STORE_REVIEW_SCENE_SETTLE_MS,
  PIXAP_APP_STORE_URL,
  PIXAP_PLAY_STORE_URL,
} from "./constants";
import { isProductionReviewRuntime } from "./isProductionReviewRuntime";

const MAX_SCENE_RETRIES = 3;
const RETRY_DELAY_MS = 600;
/** iOS only: SKStoreReviewController JS promise may never resolve. */
const NATIVE_INVOKE_MAX_WAIT_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function resolveStoreUrl(): string {
  const storeUrl = StoreReview.storeUrl();
  if (storeUrl) return storeUrl;

  const extra = Constants.expoConfig?.extra as
    | { appStoreUrl?: string; playStoreUrl?: string }
    | undefined;

  if (Platform.OS === "android") {
    return extra?.playStoreUrl ?? PIXAP_PLAY_STORE_URL;
  }

  return extra?.appStoreUrl ?? PIXAP_APP_STORE_URL;
}

async function invokeNativeRequestReview(): Promise<boolean> {
  try {
    if (Platform.OS === "android") {
      await StoreReview.requestReview();
      if (__DEV__) devLog("[store-review] requestReview() invoked on Android");
      return true;
    }

    const pending = StoreReview.requestReview();
    await Promise.race([pending, sleep(NATIVE_INVOKE_MAX_WAIT_MS)]);
    if (__DEV__) devLog("[store-review] requestReview() invoked on iOS");
    return true;
  } catch (error) {
    if (__DEV__) devWarn("[store-review] requestReview failed", error);
    return false;
  }
}

async function attemptRequestReview(): Promise<boolean> {
  if (AppState.currentState !== "active") return false;

  try {
    if (await StoreReview.isAvailableAsync()) {
      return invokeNativeRequestReview();
    }

    if (!isProductionReviewRuntime()) {
      const storeUrl = resolveStoreUrl();
      if (await Linking.canOpenURL(storeUrl)) {
        await Linking.openURL(storeUrl);
        if (__DEV__) devLog("[store-review] opened Store URL fallback");
        return true;
      }
    }

    if (await StoreReview.hasAction()) {
      return invokeNativeRequestReview();
    }

    if (__DEV__) {
      devWarn("[store-review] no native review action and no store URL available");
    }
    return false;
  } catch (error) {
    if (__DEV__) {
      devWarn("[store-review] attemptRequestReview failed", error);
    }
    return false;
  }
}

export async function requestStoreReview(): Promise<boolean> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return false;

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
