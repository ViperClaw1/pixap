import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { appAlert } from "@/shared/ui/app-popup";
import { useAiDataConsent } from "../model/useAiDataConsent";
import { AiDataConsentModal } from "./AiDataConsentModal";

export function AiBookingStepConsentPrompt() {
  const { t } = useTranslation();
  const { status, needsPrompt, grant, decline } = useAiDataConsent();
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (status === "loading" || !needsPrompt) return;
    setVisible(true);
  }, [needsPrompt, status]);

  useEffect(() => {
    if (!needsPrompt) setVisible(false);
  }, [needsPrompt]);

  if (status === "loading" || !visible) return null;

  const onAllow = () => {
    setPending(true);
    void grant()
      .then(() => setVisible(false))
      .catch(() => {
        appAlert(t("aiConsent.saveFailedTitle"), t("aiConsent.saveFailed"), undefined, "alert");
      })
      .finally(() => setPending(false));
  };

  const onDecline = () => {
    setPending(true);
    void decline()
      .then(() => setVisible(false))
      .catch(() => {
        appAlert(t("aiConsent.saveFailedTitle"), t("aiConsent.saveFailed"), undefined, "alert");
      })
      .finally(() => setPending(false));
  };

  return (
    <AiDataConsentModal
      visible
      loading={pending}
      onAllow={onAllow}
      onDecline={onDecline}
    />
  );
}
