import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import {
  loadForegroundUsageMs,
  loadReviewState,
  markReviewRequested,
  saveForegroundUsageMs,
  shouldRequestReview,
} from "../lib/appStoreReviewStorage";
import {
  APP_STORE_REVIEW_DEV_RETRY_MS,
  APP_STORE_REVIEW_MIN_SESSION_MS,
  APP_STORE_REVIEW_POST_NAV_SETTLE_MS,
} from "../lib/constants";
import { isProductionAppStoreReviewRuntime } from "../lib/isProductionAppStoreReviewRuntime";
import { requestAppStoreReview } from "../lib/requestAppStoreReview";
import {
  getAppNavigationReadyAt,
  isAppNavigationReady,
  onAppNavigationReady,
} from "@/shared/lib/appNavigationReady";
import { devLog } from "@/shared/lib/devLog";
import type { AppStoreReviewState } from "../types";

const FLUSH_INTERVAL_MS = __DEV__ ? 5_000 : 30_000;

type Options = {
  /** When true, native review may be requested after the usage threshold is met. */
  enabled: boolean;
};

function canPromptForSession(sessionStartedAt: number | null, navigationReadyAt: number | null): boolean {
  if (sessionStartedAt == null || navigationReadyAt == null) return false;
  const now = Date.now();
  if (now - navigationReadyAt < APP_STORE_REVIEW_POST_NAV_SETTLE_MS) return false;
  if (now - sessionStartedAt < APP_STORE_REVIEW_MIN_SESSION_MS) return false;
  return true;
}

export function useAppStoreReviewRequest({ enabled }: Options) {
  const usageMsRef = useRef(0);
  const reviewStateRef = useRef<AppStoreReviewState>({});
  const activeSinceRef = useRef<number | null>(null);
  const foregroundSessionStartedAtRef = useRef<number | null>(null);
  const enabledRef = useRef(enabled);
  const lastDevRequestAtRef = useRef(0);
  const [hydrated, setHydrated] = useState(false);
  const [navigationReadyAt, setNavigationReadyAt] = useState<number | null>(() =>
    isAppNavigationReady() ? getAppNavigationReadyAt() : null,
  );
  const requestingRef = useRef(false);

  enabledRef.current = enabled;

  const markForegroundSessionStart = useCallback(() => {
    const now = Date.now();
    foregroundSessionStartedAtRef.current = now;
    activeSinceRef.current = now;
  }, []);

  const syncActiveUsage = useCallback(() => {
    if (activeSinceRef.current == null) return usageMsRef.current;
    return usageMsRef.current + (Date.now() - activeSinceRef.current);
  }, []);

  const persistUsage = useCallback(async () => {
    const total = syncActiveUsage();
    usageMsRef.current = total;
    activeSinceRef.current = AppState.currentState === "active" ? Date.now() : null;
    await saveForegroundUsageMs(total);
    return total;
  }, [syncActiveUsage]);

  const tryRequestReview = useCallback(async () => {
    if (Platform.OS !== "ios" || requestingRef.current) return;

    const total = await persistUsage();
    if (!enabledRef.current) return;
    if (!shouldRequestReview(total, reviewStateRef.current)) return;
    if (AppState.currentState !== "active") return;

    if (!canPromptForSession(foregroundSessionStartedAtRef.current, navigationReadyAt)) {
      return;
    }

    if (!isProductionAppStoreReviewRuntime()) {
      const sinceLastAttempt = Date.now() - lastDevRequestAtRef.current;
      if (lastDevRequestAtRef.current > 0 && sinceLastAttempt < APP_STORE_REVIEW_DEV_RETRY_MS) {
        return;
      }
    }

    if (__DEV__) {
      devLog(`[app-store-review] threshold reached (${Math.round(total / 1000)}s foreground), requesting…`);
    }

    requestingRef.current = true;
    lastDevRequestAtRef.current = Date.now();
    try {
      const requested = await requestAppStoreReview();
      if (requested && isProductionAppStoreReviewRuntime()) {
        reviewStateRef.current = { requestedAt: Date.now() };
        await markReviewRequested();
      }
    } finally {
      requestingRef.current = false;
    }
  }, [navigationReadyAt, persistUsage]);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    return onAppNavigationReady(() => {
      setNavigationReadyAt(getAppNavigationReadyAt());
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    let cancelled = false;

    void (async () => {
      const [usageMs, reviewState] = await Promise.all([loadForegroundUsageMs(), loadReviewState()]);
      if (cancelled) return;

      usageMsRef.current = usageMs;
      reviewStateRef.current = isProductionAppStoreReviewRuntime() ? reviewState : {};
      setHydrated(true);

      if (AppState.currentState === "active") {
        markForegroundSessionStart();
      }

      if (__DEV__) {
        devLog(`[app-store-review] hydrated, accumulated ${Math.round(usageMs / 1000)}s`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [markForegroundSessionStart]);

  useEffect(() => {
    if (Platform.OS !== "ios" || !hydrated) return;

    const onAppStateChange = (next: string) => {
      if (next === "active") {
        markForegroundSessionStart();
        void tryRequestReview();
        return;
      }

      if (activeSinceRef.current != null) {
        usageMsRef.current += Date.now() - activeSinceRef.current;
        activeSinceRef.current = null;
        foregroundSessionStartedAtRef.current = null;
        void saveForegroundUsageMs(usageMsRef.current);
      }
    };

    const sub = AppState.addEventListener("change", onAppStateChange);
    const interval = setInterval(() => {
      if (AppState.currentState !== "active" || activeSinceRef.current == null) return;
      void tryRequestReview();
    }, FLUSH_INTERVAL_MS);

    return () => {
      sub.remove();
      clearInterval(interval);
      void persistUsage();
    };
  }, [hydrated, markForegroundSessionStart, persistUsage, tryRequestReview]);
}
