import { DEFAULT_TEMPERAMENT, type OnboardingStep, type Temperament, type UserPreferences } from "../model/types";
import { ONBOARDING_STEPS } from "../model/types";

function parseTemperament(raw: unknown): Temperament {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_TEMPERAMENT };
  const o = raw as Record<string, unknown>;
  const clamp = (v: unknown, fallback: number) => {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(100, Math.round(n)));
  };
  return {
    introvert: clamp(o.introvert, DEFAULT_TEMPERAMENT.introvert),
    socialEnergy: clamp(o.socialEnergy, DEFAULT_TEMPERAMENT.socialEnergy),
    adventurousness: clamp(o.adventurousness, DEFAULT_TEMPERAMENT.adventurousness),
    planning: clamp(o.planning, DEFAULT_TEMPERAMENT.planning),
  };
}

function parseStep(raw: unknown): OnboardingStep {
  if (typeof raw === "string" && (ONBOARDING_STEPS as readonly string[]).includes(raw)) {
    return raw as OnboardingStep;
  }
  return "venue_categories";
}

export function parseUserPreferencesRow(row: Record<string, unknown>): UserPreferences {
  return {
    user_id: String(row.user_id ?? ""),
    favorite_categories: Array.isArray(row.favorite_categories) ? (row.favorite_categories as string[]) : [],
    favorite_music: Array.isArray(row.favorite_music) ? (row.favorite_music as string[]) : [],
    vibe_preferences: Array.isArray(row.vibe_preferences) ? (row.vibe_preferences as string[]) : [],
    habits: Array.isArray(row.habits) ? (row.habits as string[]) : [],
    temperament: parseTemperament(row.temperament),
    onboarding_completed: Boolean(row.onboarding_completed),
    onboarding_step: parseStep(row.onboarding_step),
    onboarding_skipped_at: typeof row.onboarding_skipped_at === "string" ? row.onboarding_skipped_at : null,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString(),
  };
}

export function isOnboardingSkipped(prefs: UserPreferences | null | undefined): boolean {
  return Boolean(prefs?.onboarding_skipped_at) && !prefs?.onboarding_completed;
}
