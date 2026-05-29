import type { OnboardingStep, Temperament } from "@/entities/user-preferences";

export type OnboardingWizardSnapshot = {
  step: OnboardingStep;
  selectedCity: string;
  favoriteCategories: string[];
  vibePreferences: string[];
  habits: string[];
  favoriteMusic: string[];
  temperament: Temperament;
};

/** Payload for step_completed — selections at the moment user leaves the step. */
export function buildStepCompletedPayload(snapshot: OnboardingWizardSnapshot): Record<string, unknown> {
  const { step } = snapshot;
  switch (step) {
    case "city_selection":
      return { city: snapshot.selectedCity.trim() || null };
    case "venue_categories":
      return selectionPayload(snapshot.favoriteCategories);
    case "vibe_preferences":
      return selectionPayload(snapshot.vibePreferences);
    case "habits":
      return selectionPayload(snapshot.habits);
    case "music_taste":
      return selectionPayload(snapshot.favoriteMusic);
    case "temperament":
      return { temperament: snapshot.temperament };
    default:
      return {};
  }
}

/** Payload when user skips from a given step. */
export function buildStepSkippedPayload(snapshot: OnboardingWizardSnapshot): Record<string, unknown> {
  const completed = buildStepCompletedPayload(snapshot);
  return { ...completed, skipped_from: snapshot.step };
}

function selectionPayload(selected: string[]): Record<string, unknown> {
  return {
    selected_count: selected.length,
    selected,
  };
}
