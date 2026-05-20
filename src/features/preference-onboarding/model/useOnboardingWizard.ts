import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_TEMPERAMENT,
  STAGE1_STEPS,
  useUpsertUserPreferences,
  useUserPreferences,
  type OnboardingStep,
  type Temperament,
  type UserPreferencesPatch,
} from "@/entities/user-preferences";
import { saveOnboardingDraft } from "../lib/onboardingDraftStorage";

const AUTOSAVE_MS = 300;

export function useOnboardingWizard(initialStep?: OnboardingStep) {
  const { data: serverPrefs, isLoading } = useUserPreferences();
  const upsert = useUpsertUserPreferences();

  const [step, setStep] = useState<OnboardingStep>(initialStep ?? "venue_categories");
  const [favoriteCategories, setFavoriteCategories] = useState<string[]>([]);
  const [vibePreferences, setVibePreferences] = useState<string[]>([]);
  const [habits, setHabits] = useState<string[]>([]);
  const [favoriteMusic, setFavoriteMusic] = useState<string[]>([]);
  const [temperament, setTemperament] = useState<Temperament>({ ...DEFAULT_TEMPERAMENT });
  const hydratedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isLoading || hydratedRef.current) return;
    hydratedRef.current = true;
    if (!serverPrefs) return;

    setFavoriteCategories(serverPrefs.favorite_categories);
    setVibePreferences(serverPrefs.vibe_preferences);
    setHabits(serverPrefs.habits);
    setFavoriteMusic(serverPrefs.favorite_music);
    setTemperament(serverPrefs.temperament);
    if (!initialStep && serverPrefs.onboarding_step !== "completed") {
      setStep(serverPrefs.onboarding_step);
    }
  }, [serverPrefs, isLoading, initialStep]);

  const patchForStep = useCallback((): UserPreferencesPatch => {
    return {
      favorite_categories: favoriteCategories,
      vibe_preferences: vibePreferences,
      habits,
      favorite_music: favoriteMusic,
      temperament,
      onboarding_step: step,
    };
  }, [favoriteCategories, vibePreferences, habits, favoriteMusic, temperament, step]);

  const flushSave = useCallback(
    async (extra?: UserPreferencesPatch) => {
      const patch = { ...patchForStep(), ...extra };
      await saveOnboardingDraft(patch);
      await upsert.mutateAsync(patch);
    },
    [patchForStep, upsert],
  );

  const scheduleSave = useCallback(
    (override?: UserPreferencesPatch) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      const patch = { ...patchForStep(), ...override };
      void saveOnboardingDraft(patch);
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        void upsert.mutateAsync(patch);
      }, AUTOSAVE_MS);
    },
    [patchForStep, upsert],
  );

  const stage1Index = useMemo(() => STAGE1_STEPS.indexOf(step as (typeof STAGE1_STEPS)[number]), [step]);
  const isStage1 = stage1Index >= 0;

  const canContinue = useMemo(() => {
    switch (step) {
      case "venue_categories":
        return favoriteCategories.length > 0;
      case "vibe_preferences":
        return vibePreferences.length > 0;
      case "habits":
        return habits.length > 0;
      case "music_taste":
        return favoriteMusic.length > 0;
      case "temperament":
        return true;
      default:
        return true;
    }
  }, [step, favoriteCategories, vibePreferences, habits, favoriteMusic]);

  const progress = useMemo(() => {
    if (step === "venue_ratings") return 0.85;
    if (step === "completed") return 1;
    if (isStage1) return (stage1Index + 1) / (STAGE1_STEPS.length + 1);
    return 0;
  }, [isStage1, stage1Index, step]);

  const goNext = useCallback(async () => {
    if (!canContinue) return;
    if (isStage1 && stage1Index < STAGE1_STEPS.length - 1) {
      const next = STAGE1_STEPS[stage1Index + 1] as OnboardingStep;
      setStep(next);
      await flushSave({ onboarding_step: next });
      return;
    }
    if (step === "temperament") {
      setStep("venue_ratings");
      await flushSave({ onboarding_step: "venue_ratings" });
      return;
    }
  }, [canContinue, flushSave, isStage1, stage1Index, step]);

  const goBack = useCallback(() => {
    if (step === "venue_ratings") {
      setStep("temperament");
      void scheduleSave({ onboarding_step: "temperament" });
      return;
    }
    if (isStage1 && stage1Index > 0) {
      const prev = STAGE1_STEPS[stage1Index - 1] as OnboardingStep;
      setStep(prev);
      void scheduleSave({ onboarding_step: prev });
    }
  }, [isStage1, scheduleSave, stage1Index, step]);

  type ChipField = "favorite_categories" | "vibe_preferences" | "habits" | "favorite_music";

  const toggleChip = useCallback(
    (list: string[], setList: (v: string[]) => void, id: string, field: ChipField) => {
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
      setList(next);
      scheduleSave({ [field]: next } as UserPreferencesPatch);
    },
    [scheduleSave],
  );

  const updateTemperament = useCallback(
    (key: keyof Temperament, value: number) => {
      const next = { ...temperament, [key]: value };
      setTemperament(next);
      scheduleSave({ temperament: next });
    },
    [scheduleSave, temperament],
  );

  const skipOnboarding = useCallback(async () => {
    await flushSave({
      onboarding_skipped_at: new Date().toISOString(),
      onboarding_step: step,
    });
  }, [flushSave, step]);

  const completeOnboarding = useCallback(async () => {
    await flushSave({
      onboarding_completed: true,
      onboarding_step: "completed",
      clear_skipped: true,
    });
  }, [flushSave]);

  return {
    isLoading,
    step,
    setStep,
    progress,
    isStage1,
    canGoBack: step !== "venue_categories",
    favoriteCategories,
    vibePreferences,
    habits,
    favoriteMusic,
    temperament,
    toggleCategory: (id: string) => toggleChip(favoriteCategories, setFavoriteCategories, id, "favorite_categories"),
    toggleVibe: (id: string) => toggleChip(vibePreferences, setVibePreferences, id, "vibe_preferences"),
    toggleHabit: (id: string) => toggleChip(habits, setHabits, id, "habits"),
    toggleMusic: (id: string) => toggleChip(favoriteMusic, setFavoriteMusic, id, "favorite_music"),
    updateTemperament,
    goNext,
    goBack,
    skipOnboarding,
    completeOnboarding,
    flushSave,
    canContinue,
  };
}
