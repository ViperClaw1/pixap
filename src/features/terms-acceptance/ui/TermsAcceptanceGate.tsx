import { useCallback, useState } from "react";
import { Modal } from "react-native";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { AppPopupModal, appAlert } from "@/shared/ui/app-popup";
import { useAuth } from "@/app/providers/AuthProvider";
import { useProfile, type Profile } from "@/entities/user";
import { queryKeys } from "@/shared/api/queryKeys";
import { acceptTermsOfService } from "@/features/ugc-moderation";
import { TermsGateMessage } from "./TermsGateMessage";

export function TermsAcceptanceGate() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { data: profile, isLoading } = useProfile({ enabled: !!user });
  const queryClient = useQueryClient();

  const needsAcceptance = !!user && !isLoading && profile && !profile.terms_accepted_at;
  const [acceptPending, setAcceptPending] = useState(false);

  const onAccept = useCallback(async () => {
    if (!user) return;

    setAcceptPending(true);
    try {
      await acceptTermsOfService();

      const acceptedAt = new Date().toISOString();
      queryClient.setQueryData<Profile>(queryKeys.profile.user(user.id), (current) =>
        current ? { ...current, terms_accepted_at: acceptedAt } : current,
      );
      await queryClient.refetchQueries({ queryKey: queryKeys.profile.user(user.id) });
    } catch {
      appAlert(t("legal.termsGateAcceptFailedTitle"), t("legal.termsGateAcceptFailed"), undefined, "alert");
    } finally {
      setAcceptPending(false);
    }
  }, [queryClient, t, user]);

  if (!needsAcceptance) return null;

  return (
    <Modal visible transparent animationType="fade">
      <AppPopupModal
        embedded
        visible
        variant="info"
        title={t("legal.termsGateTitle")}
        message={<TermsGateMessage />}
        loading={acceptPending}
        onClose={() => {}}
        buttons={[
          { text: t("legal.termsGateDecline"), style: "cancel", onPress: () => void signOut() },
          { text: t("legal.termsGateAccept"), onPress: () => void onAccept(), skipCloseOnPress: true },
        ]}
      />
    </Modal>
  );
}
