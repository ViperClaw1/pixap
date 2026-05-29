import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Platform, Pressable, Text, View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import type { ProfileStackParamList } from "@/app/navigation/types";
import { useTrackOnboardingEvent } from "@/entities/onboarding-analytics";
import {
  useOnboardingWizard,
  clearOnboardingDraft,
  buildStepCompletedPayload,
  buildStepSkippedPayload,
} from "@/features/preference-onboarding";
import { PageI18nProvider } from "@/shared/lib/i18n";
import { OnboardingProgressBar } from "@/shared/ui/onboarding/OnboardingProgressBar";
import { primaryPressableStyle, primaryPressableTextStyle } from "@/shared/theme/primaryPressable";
import { CitySelectionStep } from "./steps/CitySelectionStep";
import { HabitsStep } from "./steps/HabitsStep";
import { MusicTasteStep } from "./steps/MusicTasteStep";
import { OnboardingVenueRatingStep } from "./steps/OnboardingVenueRatingStep";
import { TemperamentStep } from "./steps/TemperamentStep";
import { VenueCategoriesStep } from "./steps/VenueCategoriesStep";
import { VibePreferencesStep } from "./steps/VibePreferencesStep";
import { OnboardingStepTransition } from "./OnboardingStepTransition";
import { useAndroidFullSwipeBackPanHandlers } from "@/shared/lib/useAndroidFullSwipeBackPanHandlers";

type Route = RouteProp<ProfileStackParamList, "PreferenceOnboarding">;
type Nav = NativeStackNavigationProp<ProfileStackParamList, "PreferenceOnboarding">;

function PreferenceOnboardingContent() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { track } = useTrackOnboardingEvent();

  const wizard = useOnboardingWizard(route.params?.retake ? "city_selection" : undefined);
  const sessionStartedRef = useRef(false);
  const [stepDirection, setStepDirection] = useState<1 | -1>(1);

  const wizardSnapshot = useMemo(
    () => ({
      step: wizard.step,
      selectedCity: wizard.selectedCity,
      favoriteCategories: wizard.favoriteCategories,
      vibePreferences: wizard.vibePreferences,
      habits: wizard.habits,
      favoriteMusic: wizard.favoriteMusic,
      temperament: wizard.temperament,
    }),
    [
      wizard.step,
      wizard.selectedCity,
      wizard.favoriteCategories,
      wizard.vibePreferences,
      wizard.habits,
      wizard.favoriteMusic,
      wizard.temperament,
    ],
  );

  /** Once per screen session — not on every step change. */
  useEffect(() => {
    if (wizard.isLoading || sessionStartedRef.current) return;
    sessionStartedRef.current = true;
    track({
      event_name: "onboarding_started",
      step: wizard.step,
      payload: {
        source: route.params?.source ?? null,
        retake: Boolean(route.params?.retake),
      },
    });
  }, [wizard.isLoading, wizard.step, route.params?.source, route.params?.retake, track]);

  const resetToProfileMain = useCallback(() => {
    navigation.reset({ index: 0, routes: [{ name: "ProfileMain" }] });
  }, [navigation]);

  const exit = useCallback(() => {
    navigation.goBack();
    if (navigation.canGoBack()) return;
    resetToProfileMain();
  }, [navigation, resetToProfileMain]);

  const handleSkip = useCallback(async () => {
    track({
      event_name: "step_skipped",
      step: wizard.step,
      payload: buildStepSkippedPayload(wizardSnapshot),
    });
    await wizard.skipOnboarding();
    exit();
  }, [exit, track, wizard, wizardSnapshot]);

  const handleVenueStageComplete = useCallback(async () => {
    await wizard.completeOnboarding();
    await clearOnboardingDraft();
    resetToProfileMain();
  }, [resetToProfileMain, wizard]);

  const handleNext = useCallback(async () => {
    track({
      event_name: "step_completed",
      step: wizard.step,
      payload: buildStepCompletedPayload(wizardSnapshot),
    });
    await wizard.goNext();
  }, [track, wizard, wizardSnapshot]);

  const navigateForward = useCallback(() => {
    setStepDirection(1);
    void handleNext();
  }, [handleNext]);

  const navigateBack = useCallback(() => {
    setStepDirection(-1);
    wizard.goBack();
  }, [wizard]);

  const isFirstStep = wizard.step === "city_selection";
  const isVenueStep = wizard.step === "venue_ratings";
  const androidSwipeBackPanHandlers = useAndroidFullSwipeBackPanHandlers(navigation, {
    swipeBackFallback: exit,
  });

  const handleSwipeBack = useCallback(() => {
    if (wizard.canGoBack) {
      navigateBack();
      return;
    }
    exit();
  }, [exit, navigateBack, wizard.canGoBack]);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    navigation.setOptions({
      gestureEnabled: isFirstStep,
      fullScreenGestureEnabled: isFirstStep,
    });
  }, [isFirstStep, navigation]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (wizard.isLoading) return false;
      if (isVenueStep) {
        if (wizard.canGoBack) {
          navigateBack();
          return true;
        }
        return false;
      }
      handleSwipeBack();
      return true;
    });
    return () => sub.remove();
  }, [handleSwipeBack, isVenueStep, navigateBack, wizard.canGoBack, wizard.isLoading]);

  const venueRatingPreferences = useMemo(
    () => ({
      favoriteCategories: wizard.favoriteCategories,
      vibePreferences: wizard.vibePreferences,
      habits: wizard.habits,
      favoriteMusic: wizard.favoriteMusic,
    }),
    [wizard.favoriteCategories, wizard.vibePreferences, wizard.habits, wizard.favoriteMusic],
  );

  const continueDisabled = useMemo(() => !wizard.canContinue, [wizard.canContinue]);
  const canSwipeForward = !isVenueStep && wizard.canContinue;
  const canSwipeBack = !isVenueStep;

  if (wizard.isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const renderStep = () => {
    switch (wizard.step) {
      case "city_selection":
        return (
          <CitySelectionStep
            selected={wizard.selectedCity}
            onSelect={wizard.setSelectedCity}
          />
        );
      case "venue_categories":
        return <VenueCategoriesStep selected={wizard.favoriteCategories} onToggle={wizard.toggleCategory} />;
      case "vibe_preferences":
        return <VibePreferencesStep selected={wizard.vibePreferences} onToggle={wizard.toggleVibe} />;
      case "habits":
        return <HabitsStep selected={wizard.habits} onToggle={wizard.toggleHabit} />;
      case "music_taste":
        return <MusicTasteStep selected={wizard.favoriteMusic} onToggle={wizard.toggleMusic} />;
      case "temperament":
        return <TemperamentStep value={wizard.temperament} onChange={wizard.updateTemperament} />;
      case "venue_ratings":
        return (
          <OnboardingVenueRatingStep
            preferences={venueRatingPreferences}
            onComplete={() => void handleVenueStageComplete()}
          />
        );
      default:
        return null;
    }
  };

  return (
    <View
      style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}
      {...(isFirstStep ? androidSwipeBackPanHandlers : {})}
    >
      <View style={styles.header}>
        {wizard.canGoBack ? (
          <Pressable onPress={navigateBack} hitSlop={12}>
            <Text style={{ color: colors.primary, fontWeight: "600" }}>{t("back", { keyPrefix: "onboarding.actions" })}</Text>
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
        <Pressable onPress={() => void handleSkip()} hitSlop={12}>
          <Text style={{ color: colors.textMuted, fontWeight: "600" }}>{t("skip", { keyPrefix: "onboarding.actions" })}</Text>
        </Pressable>
      </View>

      <OnboardingProgressBar progress={wizard.progress} />

      <View style={styles.body}>
        <OnboardingStepTransition
          stepKey={wizard.step}
          direction={stepDirection}
          canSwipeForward={canSwipeForward}
          canSwipeBack={canSwipeBack}
          enableSwipe={!isVenueStep}
          onSwipeForward={navigateForward}
          onSwipeBack={handleSwipeBack}
        >
          {renderStep()}
        </OnboardingStepTransition>
      </View>

      {!isVenueStep ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            style={[primaryPressableStyle, continueDisabled && styles.continueDisabled]}
            onPress={navigateForward}
            disabled={continueDisabled}
          >
            <Text style={primaryPressableTextStyle}>
              {wizard.step === "temperament"
                ? t("startRating", { keyPrefix: "onboarding.actions" })
                : t("continue", { keyPrefix: "onboarding.actions" })}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export default function PreferenceOnboardingPage() {
  return (
    <PageI18nProvider>
      <PreferenceOnboardingContent />
    </PageI18nProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  headerSpacer: { width: 48 },
  body: { flex: 1, overflow: "hidden" },
  footer: { paddingTop: 8 },
  continueDisabled: { opacity: 0.45 },
});
