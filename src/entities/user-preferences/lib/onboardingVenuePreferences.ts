export type OnboardingVenuePreferences = {
  favoriteCategories: string[];
  vibePreferences: string[];
  habits: string[];
  favoriteMusic: string[];
};

export function buildOnboardingVenuePreferencesFingerprint(
  prefs: OnboardingVenuePreferences,
): string {
  const norm = (arr: string[]) => [...arr].map((s) => s.trim().toLowerCase()).filter(Boolean).sort().join(",");
  return [
    norm(prefs.favoriteCategories),
    norm(prefs.vibePreferences),
    norm(prefs.habits),
    norm(prefs.favoriteMusic),
  ].join("|");
}

export function hasOnboardingVenuePreferences(prefs: OnboardingVenuePreferences): boolean {
  return (
    prefs.favoriteCategories.length > 0 ||
    prefs.vibePreferences.length > 0 ||
    prefs.habits.length > 0 ||
    prefs.favoriteMusic.length > 0
  );
}

export function toOnboardingVenuesRpcPrefs(prefs: OnboardingVenuePreferences) {
  return {
    favorite_categories: prefs.favoriteCategories,
    vibe_preferences: prefs.vibePreferences,
    habits: prefs.habits,
    favorite_music: prefs.favoriteMusic,
  };
}
