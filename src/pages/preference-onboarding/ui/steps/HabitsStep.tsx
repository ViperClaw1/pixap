import { HABIT_OPTIONS } from "@/entities/user-preferences";
import { PageI18nProvider } from "@/shared/lib/i18n";
import { OnboardingChipGrid } from "@/shared/ui/onboarding/OnboardingChipGrid";
import { OnboardingStepLayout } from "./OnboardingStepLayout";
import { useOnboardingStepCopy } from "./useOnboardingStepCopy";

type Props = {
  selected: string[];
  onToggle: (id: string) => void;
};

function HabitsStepContent({ selected, onToggle }: Props) {
  const { title, subtitle } = useOnboardingStepCopy("onboarding.steps.habits");
  return (
    <OnboardingStepLayout title={title} subtitle={subtitle}>
      <OnboardingChipGrid options={HABIT_OPTIONS} selected={selected} onToggle={onToggle} />
    </OnboardingStepLayout>
  );
}

export function HabitsStep(props: Props) {
  return (
    <PageI18nProvider>
      <HabitsStepContent {...props} />
    </PageI18nProvider>
  );
}
