export const ONBOARDING_STEPS = [
  "venue_categories",
  "vibe_preferences",
  "habits",
  "music_taste",
  "temperament",
  "venue_ratings",
  "completed",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export type Temperament = {
  introvert: number;
  socialEnergy: number;
  adventurousness: number;
  planning: number;
};

export const DEFAULT_TEMPERAMENT: Temperament = {
  introvert: 50,
  socialEnergy: 50,
  adventurousness: 50,
  planning: 50,
};

export type UserPreferences = {
  user_id: string;
  favorite_categories: string[];
  favorite_music: string[];
  vibe_preferences: string[];
  habits: string[];
  temperament: Temperament;
  onboarding_completed: boolean;
  onboarding_step: OnboardingStep;
  onboarding_skipped_at: string | null;
  updated_at: string;
};

export type UserPreferencesPatch = Partial<{
  favorite_categories: string[];
  favorite_music: string[];
  vibe_preferences: string[];
  habits: string[];
  temperament: Temperament;
  onboarding_completed: boolean;
  onboarding_step: OnboardingStep;
  onboarding_skipped_at: string | null;
  clear_skipped: boolean;
}>;

export type OnboardingVenue = {
  venue_id: string;
  name: string;
  description: string;
  tags: string[];
  images: string[];
  city: string | null;
  category_name: string;
  match_score: number;
  rating: number;
};
