import { VIBE_OPTIONS } from "@/entities/user-preferences";
import { PageI18nProvider } from "@/shared/lib/i18n";
import { OnboardingChipGrid } from "@/shared/ui/onboarding/OnboardingChipGrid";
import { OnboardingStepLayout } from "./OnboardingStepLayout";
import { useOnboardingStepCopy } from "./useOnboardingStepCopy";

type Props = {
  selected: string[];
  onToggle: (id: string) => void;
};

function VibePreferencesStepContent({ selected, onToggle }: Props) {
  const { title, subtitle } = useOnboardingStepCopy("onboarding.steps.vibes");
  return (
    <OnboardingStepLayout title={title} subtitle={subtitle}>
      <OnboardingChipGrid options={VIBE_OPTIONS} selected={selected} onToggle={onToggle} />
    </OnboardingStepLayout>
  );
}

export function VibePreferencesStep(props: Props) {
  return (
    <PageI18nProvider>
      <VibePreferencesStepContent {...props} />
    </PageI18nProvider>
  );
}
