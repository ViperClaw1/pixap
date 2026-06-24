import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { appAlert } from "@/shared/ui/app-popup";
import { useAiDataConsent } from "../model/useAiDataConsent";
import { AiDataConsentModal } from "./AiDataConsentModal";

export function AiBookingStepConsentPrompt() {
  const { t } = useTranslation();
  const { status, needsPrompt, grant, decline } = useAiDataConsent();
  const [visible, setVisible] = useState(false);
  const [declining, setDeclining] = useState(false);

  useEffect(() => {
    if (status === "loading" || !needsPrompt) return;
    setVisible(true);
  }, [needsPrompt, status]);

  useEffect(() => {
    if (!needsPrompt) setVisible(false);
  }, [needsPrompt]);

  if (status === "loading" || !visible) return null;

  const onAllow = () => {
    // Close the modal immediately so the consent status update (granted) and
    // the greeting message seeding happen after the modal is already gone —
    // this prevents the chat from rendering behind a still-visible overlay and
    // ensures the typewriter greeting animation is visible to the user.
    setVisible(false);
    void grant().catch(() => {
      appAlert(t("aiConsent.saveFailedTitle"), t("aiConsent.saveFailed"), undefined, "alert");
    });
  };

  const onDecline = () => {
    setDeclining(true);
    void decline()
      .then(() => setVisible(false))
      .catch(() => {
        appAlert(t("aiConsent.saveFailedTitle"), t("aiConsent.saveFailed"), undefined, "alert");
      })
      .finally(() => setDeclining(false));
  };

  return (
    <AiDataConsentModal
      visible
      loading={declining}
      onAllow={onAllow}
      onDecline={onDecline}
    />
  );
}
