import { AppPressable } from "@/shared/ui/app-pressable";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, BackHandler, Platform, Text, View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import type { ProfileStackParamList } from "@/app/navigation/types";
import { useTrackOnboardingEvent } from "@/entities/onboarding-analytics";
import { trackOnboardingAbandoned, trackOnboardingCompleted, trackOnboardingStepSkipped } from "@/shared/lib/analytics/track";
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
  const advanceLockRef = useRef(false);
  const [stepDirection, setStepDirection] = useState<1 | -1>(1);
  const [isAdvancing, setIsAdvancing] = useState(false);

  const isFirstStep = wizard.step === "city_selection";
  const isVenueStep = wizard.step === "venue_ratings";

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

  const leaveOnboardingToProfile = useCallback(() => {
    Alert.alert(
      t("onboarding.exitSetupTitle"),
      t("onboarding.exitSetupBody"),
      [
        { text: t("onboarding.exitSetupCancel"), style: "cancel" },
        {
          text: t("onboarding.exitSetupConfirm"),
          style: "destructive",
          onPress: () => {
            trackOnboardingAbandoned(wizard.step);
            void wizard.skipOnboarding().then(() => resetToProfileMain());
          },
        },
      ],
    );
  }, [resetToProfileMain, t, wizard]);

  const handleVenueStageComplete = useCallback(async () => {
    const result = await wizard.completeOnboarding();
    await clearOnboardingDraft();
    if (result.isFirstCompletion) trackOnboardingCompleted(0);
    resetToProfileMain();
  }, [resetToProfileMain, wizard]);

  const handleSkip = useCallback(async () => {
    if (isVenueStep) {
      await handleVenueStageComplete();
      return;
    }
    track({
      event_name: "step_skipped",
      step: wizard.step,
      payload: buildStepSkippedPayload(wizardSnapshot),
    });
    trackOnboardingStepSkipped(wizard.step);
    await wizard.skipStep();
  }, [handleVenueStageComplete, isVenueStep, track, wizard, wizardSnapshot]);

  const handleNext = useCallback(async () => {
    if (advanceLockRef.current || !wizard.canContinue) return;
    advanceLockRef.current = true;
    setIsAdvancing(true);
    try {
      track({
        event_name: "step_completed",
        step: wizard.step,
        payload: buildStepCompletedPayload(wizardSnapshot),
      });
      await wizard.goNext();
    } finally {
      advanceLockRef.current = false;
      setIsAdvancing(false);
    }
  }, [track, wizard, wizardSnapshot]);

  const navigateForward = useCallback(() => {
    if (isAdvancing) return;
    setStepDirection(1);
    void handleNext();
  }, [handleNext, isAdvancing]);

  const navigateBack = useCallback(() => {
    setStepDirection(-1);
    wizard.goBack();
  }, [wizard]);

  const androidSwipeBackPanHandlers = useAndroidFullSwipeBackPanHandlers(navigation, {
    swipeBackFallback: leaveOnboardingToProfile,
  });

  const handleSwipeBack = useCallback(() => {
    if (wizard.canGoBack) {
      navigateBack();
      return;
    }
    leaveOnboardingToProfile();
  }, [leaveOnboardingToProfile, navigateBack, wizard.canGoBack]);

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

  const continueDisabled = useMemo(() => !wizard.canContinue || isAdvancing, [isAdvancing, wizard.canContinue]);
  const canSwipeForward = !isVenueStep && wizard.canContinue && !isAdvancing;
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
          <AppPressable onPress={navigateBack} hitSlop={12} disabled={isAdvancing}>
            <Text style={{ color: colors.primary, fontWeight: "600", opacity: isAdvancing ? 0.45 : 1 }}>
              {t("back", { keyPrefix: "onboarding.actions" })}
            </Text>
          </AppPressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
        <AppPressable onPress={() => void handleSkip()} hitSlop={12} disabled={isAdvancing}>
          <Text style={{ color: colors.textMuted, fontWeight: "600", opacity: isAdvancing ? 0.45 : 1 }}>
            {t("skip", { keyPrefix: "onboarding.actions" })}
          </Text>
        </AppPressable>
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
        <View style={[styles.footer, { paddingBottom: Platform.OS === "android" ? 16 : insets.bottom + 16 }]}>
          <AppPressable
            style={[primaryPressableStyle, continueDisabled && styles.continueDisabled]}
            onPress={navigateForward}
            disabled={continueDisabled}
          >
            {isAdvancing ? (
              <View style={styles.continueBusyRow}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={primaryPressableTextStyle}>
                  {wizard.step === "temperament"
                    ? t("startRating", { keyPrefix: "onboarding.actions" })
                    : t("continue", { keyPrefix: "onboarding.actions" })}
                </Text>
              </View>
            ) : (
              <Text style={primaryPressableTextStyle}>
                {wizard.step === "temperament"
                  ? t("startRating", { keyPrefix: "onboarding.actions" })
                  : t("continue", { keyPrefix: "onboarding.actions" })}
              </Text>
            )}
          </AppPressable>
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
  footer: { paddingTop: 16 },
  continueDisabled: { opacity: 0.45 },
  continueBusyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
});
