import AsyncStorage from "@react-native-async-storage/async-storage";
import { APP_STORE_REVIEW_USAGE_THRESHOLD_MS } from "./constants";
import { isProductionAppStoreReviewRuntime } from "./isProductionAppStoreReviewRuntime";
import type { AppStoreReviewState } from "../types";

const USAGE_KEY = "@pixapp/foreground_usage_ms_v1";
const STATE_KEY = "@pixapp/app_store_review_prompt_v1";

export async function loadForegroundUsageMs(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(USAGE_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export async function saveForegroundUsageMs(ms: number): Promise<void> {
  await AsyncStorage.setItem(USAGE_KEY, String(Math.max(0, Math.floor(ms))));
}

export async function loadReviewState(): Promise<AppStoreReviewState> {
  try {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as AppStoreReviewState;
  } catch {
    return {};
  }
}

export async function markReviewRequested(): Promise<void> {
  const state: AppStoreReviewState = { requestedAt: Date.now() };
  await AsyncStorage.setItem(STATE_KEY, JSON.stringify(state));
}

export function shouldRequestReview(usageMs: number, state: AppStoreReviewState): boolean {
  if (isProductionAppStoreReviewRuntime() && (state.requestedAt || state.completedAt)) return false;
  return usageMs >= APP_STORE_REVIEW_USAGE_THRESHOLD_MS;
}
