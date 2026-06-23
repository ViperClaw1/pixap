import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DEFAULT_TEMPERAMENT,
  STAGE1_STEPS,
  useUpsertUserPreferences,
  useUserPreferences,
  type OnboardingStep,
  type Temperament,
  type UserPreferencesPatch,
} from "@/entities/user-preferences";
import { bootstrapMyDailyRecommendations } from "@/entities/daily-recommendation";
import { useProfile, useUpdateProfile } from "@/entities/user";
import { queryKeys } from "@/shared/api/queryKeys";
import { saveOnboardingDraft } from "../lib/onboardingDraftStorage";

const AUTOSAVE_MS = 300;
const PROGRESS_STEPS = STAGE1_STEPS.length + 1;

export function useOnboardingWizard(initialStep?: OnboardingStep) {
  const { data: serverPrefs, isLoading: prefsLoading } = useUserPreferences();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const upsert = useUpsertUserPreferences();
  const updateProfile = useUpdateProfile();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<OnboardingStep>(initialStep ?? "city_selection");
  const [selectedCity, setSelectedCity] = useState("");
  const [favoriteCategories, setFavoriteCategories] = useState<string[]>([]);
  const [vibePreferences, setVibePreferences] = useState<string[]>([]);
  const [habits, setHabits] = useState<string[]>([]);
  const [favoriteMusic, setFavoriteMusic] = useState<string[]>([]);
  const [temperament, setTemperament] = useState<Temperament>({ ...DEFAULT_TEMPERAMENT });
  const hydratedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLoading = prefsLoading || profileLoading;

  useEffect(() => {
    if (isLoading || hydratedRef.current) return;
    hydratedRef.current = true;
    if (!serverPrefs) return;

    setFavoriteCategories(serverPrefs.favorite_categories);
    setVibePreferences(serverPrefs.vibe_preferences);
    setHabits(serverPrefs.habits);
    setFavoriteMusic(serverPrefs.favorite_music);
    setTemperament(serverPrefs.temperament);

    const profileCity = profile?.city?.trim() ?? "";
    if (profileCity) {
      setSelectedCity(profileCity);
    }

    if (!initialStep && serverPrefs.onboarding_step !== "completed") {
      let nextStep = serverPrefs.onboarding_step;
      if (!profileCity && nextStep !== "city_selection") {
        nextStep = "city_selection";
      }
      setStep(nextStep);
    }
  }, [profile?.city, serverPrefs, isLoading, initialStep]);

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
      case "city_selection":
        return selectedCity.trim().length > 0;
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
  }, [step, selectedCity, favoriteCategories, vibePreferences, habits, favoriteMusic]);

  const progress = useMemo(() => {
    if (step === "venue_ratings") return (PROGRESS_STEPS + 0.85) / (PROGRESS_STEPS + 1);
    if (step === "completed") return 1;
    if (step === "city_selection") return 1 / (PROGRESS_STEPS + 1);
    if (isStage1) return (stage1Index + 2) / (PROGRESS_STEPS + 1);
    return 0;
  }, [isStage1, stage1Index, step]);

  const goNext = useCallback(async () => {
    if (!canContinue) return;

    if (step === "city_selection") {
      const city = selectedCity.trim();
      await updateProfile.mutateAsync({ city });
      await queryClient.invalidateQueries({ queryKey: queryKeys.businessCards.listPrefix });
      await queryClient.invalidateQueries({ queryKey: queryKeys.dailyRecommendations.prefix });
      setStep("venue_categories");
      await flushSave({ onboarding_step: "venue_categories" });
      return;
    }

    if (isStage1 && stage1Index < STAGE1_STEPS.length - 1) {
      const next = STAGE1_STEPS[stage1Index + 1] as OnboardingStep;
      setStep(next);
      await flushSave({ onboarding_step: next });
      return;
    }
    if (step === "temperament") {
      setStep("venue_ratings");
      await flushSave({ onboarding_step: "venue_ratings" });
    }
  }, [
    canContinue,
    flushSave,
    isStage1,
    queryClient,
    selectedCity,
    stage1Index,
    step,
    updateProfile,
  ]);

  const goBack = useCallback(() => {
    if (step === "venue_ratings") {
      setStep("temperament");
      void scheduleSave({ onboarding_step: "temperament" });
      return;
    }
    if (step === "venue_categories") {
      setStep("city_selection");
      void scheduleSave({ onboarding_step: "city_selection" });
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

  const skipStep = useCallback(async () => {
    let nextStep: OnboardingStep;
    if (step === "city_selection") {
      nextStep = "venue_categories";
    } else if (step === "temperament") {
      nextStep = "venue_ratings";
    } else if (isStage1 && stage1Index < STAGE1_STEPS.length - 1) {
      nextStep = STAGE1_STEPS[stage1Index + 1] as OnboardingStep;
    } else {
      return;
    }
    setStep(nextStep);
    await flushSave({ onboarding_step: nextStep });
  }, [flushSave, isStage1, stage1Index, step]);

  const skipOnboarding = useCallback(async () => {
    await flushSave({
      onboarding_skipped_at: new Date().toISOString(),
      onboarding_step: step,
    });
    if (selectedCity.trim()) {
      void bootstrapMyDailyRecommendations(undefined, { force: true }).then((result) => {
        if (!result) return;
        void queryClient.invalidateQueries({ queryKey: queryKeys.dailyRecommendations.prefix });
      });
    }
  }, [flushSave, queryClient, selectedCity, step]);

  const completeOnboarding = useCallback(async () => {
    const isFirstCompletion = !serverPrefs?.onboarding_completed;
    await flushSave({
      onboarding_completed: true,
      onboarding_step: "completed",
      clear_skipped: true,
    });
    if (isFirstCompletion) {
      void bootstrapMyDailyRecommendations(undefined, { force: true }).then((result) => {
        if (!result) return;
        void queryClient.invalidateQueries({ queryKey: queryKeys.dailyRecommendations.prefix });
      });
    }
    return { isFirstCompletion };
  }, [flushSave, queryClient, serverPrefs?.onboarding_completed]);

  return {
    isLoading,
    step,
    setStep,
    progress,
    isStage1,
    canGoBack: step !== "city_selection",
    selectedCity,
    setSelectedCity,
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
    skipStep,
    skipOnboarding,
    completeOnboarding,
    flushSave,
    canContinue,
  };
}
