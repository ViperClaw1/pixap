import { supabase } from "@/shared/api/supabase/client";
import {
  aiDataConsentStatusFromRecord,
  declineAiDataConsent,
  fetchAiDataConsent,
  grantAiDataConsent,
} from "../api/aiDataConsentApi";

export type AiDataConsentStatus = "loading" | "pending" | "granted" | "declined";

let consentGranted = false;
let consentDeclined = false;
let consentHydrated = false;
let consentStatus: AiDataConsentStatus = "loading";
let hydratedUserId: string | null = null;
let hydratePromise: Promise<void> | null = null;

const listeners = new Set<() => void>();

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

function applyConsentState(status: AiDataConsentStatus) {
  consentStatus = status;
  consentGranted = status === "granted";
  consentDeclined = status === "declined";
  consentHydrated = status !== "loading";
  notifyListeners();
}

export function subscribeAiDataConsent(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAiDataConsentStatus(): AiDataConsentStatus {
  return consentStatus;
}

export function getAiDataConsentSnapshot() {
  return { granted: consentGranted, declined: consentDeclined, hydrated: consentHydrated };
}

export function resetAiDataConsentState() {
  hydratedUserId = null;
  hydratePromise = null;
  consentGranted = false;
  consentDeclined = false;
  consentHydrated = false;
  consentStatus = "loading";
  notifyListeners();
}

export function isAiDataConsentGranted() {
  return consentGranted;
}

async function resolveAuthenticatedUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user?.id ?? null;
}

export function ensureAiDataConsentHydrated(userId?: string | null): Promise<void> {
  const targetUserIdPromise = userId ? Promise.resolve(userId) : resolveAuthenticatedUserId();

  return targetUserIdPromise.then((targetUserId) => {
    if (!targetUserId) {
      resetAiDataConsentState();
      applyConsentState("pending");
      return;
    }

    if (consentHydrated && hydratedUserId === targetUserId) {
      return;
    }

    if (hydratedUserId !== targetUserId) {
      hydratePromise = null;
      consentHydrated = false;
      applyConsentState("loading");
    }

    if (hydratePromise) return hydratePromise;

    hydratePromise = fetchAiDataConsent(targetUserId)
      .then((record) => {
        hydratedUserId = targetUserId;
        applyConsentState(aiDataConsentStatusFromRecord(record));
      })
      .catch(() => {
        hydratedUserId = targetUserId;
        applyConsentState("pending");
      });

    return hydratePromise;
  });
}

export async function persistAiDataConsentGrant(userId: string): Promise<string> {
  const acceptedAt = await grantAiDataConsent();
  hydratedUserId = userId;
  applyConsentState("granted");
  return acceptedAt;
}

export async function persistAiDataConsentDecline(userId: string): Promise<string> {
  const declinedAt = await declineAiDataConsent();
  hydratedUserId = userId;
  applyConsentState("declined");
  return declinedAt;
}

export async function refreshAiDataConsent(userId: string): Promise<void> {
  try {
    const record = await fetchAiDataConsent(userId);
    hydratedUserId = userId;
    applyConsentState(aiDataConsentStatusFromRecord(record));
  } catch {
    // Keep the current in-memory state when refresh fails offline.
  }
}
