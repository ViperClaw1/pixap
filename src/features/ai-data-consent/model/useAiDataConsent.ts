import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import { type Profile } from "@/entities/user";
import { queryKeys } from "@/shared/api/queryKeys";
import {
  ensureAiDataConsentHydrated,
  getAiDataConsentStatus,
  persistAiDataConsentDecline,
  persistAiDataConsentGrant,
  resetAiDataConsentState,
  subscribeAiDataConsent,
} from "./aiDataConsentState";

export type { AiDataConsentStatus } from "./aiDataConsentState";

function patchProfileAiConsent(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string,
  patch: Pick<Profile, "ai_data_consent_at" | "ai_data_consent_declined_at">,
) {
  queryClient.setQueryData<Profile>(queryKeys.profile.user(userId), (current) =>
    current ? { ...current, ...patch } : current,
  );
}

export function useAiDataConsent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const status = useSyncExternalStore(subscribeAiDataConsent, getAiDataConsentStatus, getAiDataConsentStatus);

  useEffect(() => {
    if (!user?.id) {
      resetAiDataConsentState();
      return;
    }
    void ensureAiDataConsentHydrated(user.id);
  }, [user?.id]);

  const grant = useCallback(async () => {
    if (!user?.id) return;
    const acceptedAt = await persistAiDataConsentGrant(user.id);
    patchProfileAiConsent(queryClient, user.id, {
      ai_data_consent_at: acceptedAt,
      ai_data_consent_declined_at: null,
    });
  }, [queryClient, user?.id]);

  const decline = useCallback(async () => {
    if (!user?.id) return;
    const declinedAt = await persistAiDataConsentDecline(user.id);
    patchProfileAiConsent(queryClient, user.id, {
      ai_data_consent_declined_at: declinedAt,
    });
  }, [queryClient, user?.id]);

  return {
    status,
    isGranted: status === "granted",
    isDeclined: status === "declined",
    needsPrompt: status === "pending",
    grant,
    decline,
  };
};
