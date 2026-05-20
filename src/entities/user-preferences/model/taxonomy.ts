/** Slugs align with business_cards.tags (lowercase). Extend by adding entries here. */

/** labelPrefix + id — resolved via i18n keyPrefix (ids may contain underscores). */
export type TaxonomyOption = { id: string; labelPrefix: string };

export const VENUE_CATEGORY_OPTIONS: TaxonomyOption[] = [
  { id: "bars", labelPrefix: "onboarding.categories" },
  { id: "clubs", labelPrefix: "onboarding.categories" },
  { id: "lounges", labelPrefix: "onboarding.categories" },
  { id: "techno", labelPrefix: "onboarding.categories" },
  { id: "live_music", labelPrefix: "onboarding.categories" },
  { id: "rooftop", labelPrefix: "onboarding.categories" },
  { id: "restaurants", labelPrefix: "onboarding.categories" },
  { id: "wine_bars", labelPrefix: "onboarding.categories" },
  { id: "cocktail_bars", labelPrefix: "onboarding.categories" },
  { id: "hookah_lounges", labelPrefix: "onboarding.categories" },
  { id: "cafes", labelPrefix: "onboarding.categories" },
  { id: "beach_clubs", labelPrefix: "onboarding.categories" },
  { id: "art_spaces", labelPrefix: "onboarding.categories" },
  { id: "jazz_bars", labelPrefix: "onboarding.categories" },
  { id: "underground", labelPrefix: "onboarding.categories" },
  { id: "luxury", labelPrefix: "onboarding.categories" },
  { id: "casual", labelPrefix: "onboarding.categories" },
  { id: "networking", labelPrefix: "onboarding.categories" },
  { id: "party_places", labelPrefix: "onboarding.categories" },
  { id: "quiet_places", labelPrefix: "onboarding.categories" },
];

export const VIBE_OPTIONS: TaxonomyOption[] = [
  { id: "calm", labelPrefix: "onboarding.vibes" },
  { id: "energetic", labelPrefix: "onboarding.vibes" },
  { id: "aesthetic", labelPrefix: "onboarding.vibes" },
  { id: "luxury", labelPrefix: "onboarding.vibes" },
  { id: "chaotic", labelPrefix: "onboarding.vibes" },
  { id: "underground", labelPrefix: "onboarding.vibes" },
  { id: "romantic", labelPrefix: "onboarding.vibes" },
  { id: "social", labelPrefix: "onboarding.vibes" },
  { id: "intimate", labelPrefix: "onboarding.vibes" },
  { id: "loud", labelPrefix: "onboarding.vibes" },
  { id: "cozy", labelPrefix: "onboarding.vibes" },
];

export const HABIT_OPTIONS: TaxonomyOption[] = [
  { id: "night_out", labelPrefix: "onboarding.habits" },
  { id: "books_tables", labelPrefix: "onboarding.habits" },
  { id: "spontaneous", labelPrefix: "onboarding.habits" },
  { id: "quiet_spots", labelPrefix: "onboarding.habits" },
  { id: "music_focused", labelPrefix: "onboarding.habits" },
  { id: "meet_people", labelPrefix: "onboarding.habits" },
];

export const MUSIC_OPTIONS: TaxonomyOption[] = [
  { id: "techno", labelPrefix: "onboarding.music" },
  { id: "house", labelPrefix: "onboarding.music" },
  { id: "hip_hop", labelPrefix: "onboarding.music" },
  { id: "jazz", labelPrefix: "onboarding.music" },
  { id: "afro", labelPrefix: "onboarding.music" },
  { id: "indie", labelPrefix: "onboarding.music" },
  { id: "pop", labelPrefix: "onboarding.music" },
  { id: "electronic", labelPrefix: "onboarding.music" },
  { id: "live_music", labelPrefix: "onboarding.music" },
  { id: "rnb", labelPrefix: "onboarding.music" },
  { id: "ambient", labelPrefix: "onboarding.music" },
];

export const STAGE1_STEPS = [
  "venue_categories",
  "vibe_preferences",
  "habits",
  "music_taste",
  "temperament",
] as const;

export const MIN_ONBOARDING_VENUE_RATINGS = 8;
