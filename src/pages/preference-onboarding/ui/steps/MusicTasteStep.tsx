import { MUSIC_OPTIONS } from "@/entities/user-preferences";
import { PageI18nProvider } from "@/shared/lib/i18n";
import { OnboardingChipGrid } from "@/shared/ui/onboarding/OnboardingChipGrid";
import { OnboardingStepLayout } from "./OnboardingStepLayout";
import { useOnboardingStepCopy } from "./useOnboardingStepCopy";

type Props = {
  selected: string[];
  onToggle: (id: string) => void;
};

function MusicTasteStepContent({ selected, onToggle }: Props) {
  const { title, subtitle } = useOnboardingStepCopy("onboarding.steps.music");
  return (
    <OnboardingStepLayout title={title} subtitle={subtitle}>
      <OnboardingChipGrid options={MUSIC_OPTIONS} selected={selected} onToggle={onToggle} />
    </OnboardingStepLayout>
  );
}

export function MusicTasteStep(props: Props) {
  return (
    <PageI18nProvider>
      <MusicTasteStepContent {...props} />
    </PageI18nProvider>
  );
}
