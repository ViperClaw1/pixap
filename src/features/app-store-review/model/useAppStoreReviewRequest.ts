import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import {
  loadForegroundUsageMs,
  loadReviewState,
  markReviewRequested,
  saveForegroundUsageMs,
  shouldRequestReview,
} from "../lib/appStoreReviewStorage";
import { isProductionAppStoreReviewRuntime } from "../lib/isProductionAppStoreReviewRuntime";
import { requestAppStoreReview } from "../lib/requestAppStoreReview";
import type { AppStoreReviewState } from "../types";

const FLUSH_INTERVAL_MS = 30_000;

type Options = {
  enabled: boolean;
};

export function useAppStoreReviewRequest({ enabled }: Options) {
  const usageMsRef = useRef(0);
  const reviewStateRef = useRef<AppStoreReviewState>({});
  const activeSinceRef = useRef<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const requestingRef = useRef(false);

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
    if (!enabled || Platform.OS !== "ios" || requestingRef.current) return;

    const total = await persistUsage();
    if (!shouldRequestReview(total, reviewStateRef.current)) return;
    if (AppState.currentState !== "active") return;

    requestingRef.current = true;
    try {
      const requested = await requestAppStoreReview();
      if (requested && isProductionAppStoreReviewRuntime()) {
        reviewStateRef.current = { requestedAt: Date.now() };
        await markReviewRequested();
      }
    } finally {
      requestingRef.current = false;
    }
  }, [enabled, persistUsage]);

  useEffect(() => {
    if (!enabled || Platform.OS !== "ios") return;

    let cancelled = false;

    void (async () => {
      const [usageMs, reviewState] = await Promise.all([loadForegroundUsageMs(), loadReviewState()]);
      if (cancelled) return;

      usageMsRef.current = usageMs;
      reviewStateRef.current = isProductionAppStoreReviewRuntime() ? reviewState : {};
      setHydrated(true);

      if (AppState.currentState === "active") {
        activeSinceRef.current = Date.now();
      }

      await tryRequestReview();
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, tryRequestReview]);

  useEffect(() => {
    if (!enabled || Platform.OS !== "ios" || !hydrated) return;

    const onAppStateChange = (next: string) => {
      if (next === "active") {
        activeSinceRef.current = Date.now();
        void tryRequestReview();
        return;
      }

      if (activeSinceRef.current != null) {
        usageMsRef.current += Date.now() - activeSinceRef.current;
        activeSinceRef.current = null;
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
  }, [enabled, hydrated, persistUsage, tryRequestReview]);
}
