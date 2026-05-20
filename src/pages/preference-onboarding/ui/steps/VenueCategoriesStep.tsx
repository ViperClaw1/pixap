import { VENUE_CATEGORY_OPTIONS } from "@/entities/user-preferences";
import { PageI18nProvider } from "@/shared/lib/i18n";
import { OnboardingChipGrid } from "@/shared/ui/onboarding/OnboardingChipGrid";
import { OnboardingStepLayout } from "./OnboardingStepLayout";
import { useOnboardingStepCopy } from "./useOnboardingStepCopy";

type Props = {
  selected: string[];
  onToggle: (id: string) => void;
};

function VenueCategoriesStepContent({ selected, onToggle }: Props) {
  const { title, subtitle } = useOnboardingStepCopy("onboarding.steps.venueCategories");
  return (
    <OnboardingStepLayout title={title} subtitle={subtitle}>
      <OnboardingChipGrid options={VENUE_CATEGORY_OPTIONS} selected={selected} onToggle={onToggle} />
    </OnboardingStepLayout>
  );
}

export function VenueCategoriesStep(props: Props) {
  return (
    <PageI18nProvider>
      <VenueCategoriesStepContent {...props} />
    </PageI18nProvider>
  );
}
