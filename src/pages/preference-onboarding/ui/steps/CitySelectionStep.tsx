import { PageI18nProvider } from "@/shared/lib/i18n";
import { CityPickerField } from "@/shared/ui/city-picker";
import { OnboardingStepLayout } from "./OnboardingStepLayout";
import { useOnboardingStepCopy } from "./useOnboardingStepCopy";

type Props = {
  selected: string;
  onSelect: (city: string) => void;
};

function CitySelectionStepContent({ selected, onSelect }: Props) {
  const { title, subtitle } = useOnboardingStepCopy("onboarding.steps.city");

  return (
    <OnboardingStepLayout title={title} subtitle={subtitle}>
      <CityPickerField
        value={selected}
        onChange={onSelect}
        showAllCitiesOption={false}
        variant="dropdown"
      />
    </OnboardingStepLayout>
  );
}

export function CitySelectionStep(props: Props) {
  return (
    <PageI18nProvider>
      <CitySelectionStepContent {...props} />
    </PageI18nProvider>
  );
}
