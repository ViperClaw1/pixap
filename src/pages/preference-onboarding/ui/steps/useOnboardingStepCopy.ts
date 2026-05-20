import { useTranslation } from "react-i18next";

/** Resolves onboarding step title/subtitle from nested locale keys. */
export function useOnboardingStepCopy(stepKeyPrefix: string) {
  const { t } = useTranslation();
  return {
    title: t("title", { keyPrefix: stepKeyPrefix }),
    subtitle: t("subtitle", { keyPrefix: stepKeyPrefix }),
  };
}
