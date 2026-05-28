import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import {
  MIN_ONBOARDING_VENUE_RATINGS,
  buildOnboardingVenuePreferencesFingerprint,
  useCalculateUserAffinity,
  useRecommendedOnboardingVenues,
  type OnboardingVenue,
  type OnboardingVenuePreferences,
} from "@/entities/user-preferences";
import { useUpsertVenueRating } from "@/entities/venue-rating";
import { useOnboardingRatedVenueIds } from "@/entities/venue-rating";
import { useTrackOnboardingEvent } from "@/entities/onboarding-analytics";
import { OnboardingVenueCard } from "@/widgets/onboarding-venue-card";
import { RatingScale } from "@/shared/ui/onboarding/RatingScale";
import { primaryPressableStyle, primaryPressableTextStyle } from "@/shared/theme/primaryPressable";
import { PageI18nProvider } from "@/shared/lib/i18n";

const SWIPE_THRESHOLD = 80;

type Props = {
  onComplete: () => void;
  preferences: OnboardingVenuePreferences;
  ratedCountExternal?: number;
};

function OnboardingVenueRatingStepContent({ onComplete, preferences }: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const [offset, setOffset] = useState(0);
  const [venues, setVenues] = useState<OnboardingVenue[]>([]);
  const [index, setIndex] = useState(0);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [ratedCount, setRatedCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const { favoriteCategories, vibePreferences, habits, favoriteMusic } = preferences;
  const prefsFingerprint = useMemo(
    () =>
      buildOnboardingVenuePreferencesFingerprint({
        favoriteCategories,
        vibePreferences,
        habits,
        favoriteMusic,
      }),
    [favoriteCategories, vibePreferences, habits, favoriteMusic],
  );

  useEffect(() => {
    setOffset(0);
    setVenues([]);
    setIndex(0);
  }, [prefsFingerprint]);

  const { data: page = [], isLoading } = useRecommendedOnboardingVenues(
    offset,
    preferences,
    prefsFingerprint,
    true,
  );
  const { data: alreadyRated = [] } = useOnboardingRatedVenueIds();
  const upsertRating = useUpsertVenueRating();
  const calculateAffinity = useCalculateUserAffinity();
  const { track, trackImmediate } = useTrackOnboardingEvent();

  const translateX = useSharedValue(0);

  useEffect(() => {
    if (page.length === 0) return;
    setVenues((prev) => {
      const ids = new Set(prev.map((v) => v.venue_id));
      const merged = [...prev];
      for (const v of page) {
        if (!ids.has(v.venue_id)) merged.push(v);
      }
      return merged;
    });
  }, [page]);

  useEffect(() => {
    setRatedCount(alreadyRated.length);
  }, [alreadyRated.length]);

  const current = venues[index];

  const prefetchNext = useCallback(() => {
    if (index >= venues.length - 3 && page.length > 0) {
      setOffset((o) => o + 8);
    }
  }, [index, page.length, venues.length]);

  useEffect(() => {
    prefetchNext();
  }, [prefetchNext]);

  const goToIndex = useCallback(
    (next: number) => {
      setIndex(next);
      setSelectedRating(null);
      translateX.value = 0;
      prefetchNext();
    },
    [prefetchNext, translateX],
  );

  const finishSession = useCallback(
    async (via: "min_ratings" | "finish_button", ratedCountSnapshot: number) => {
      await trackImmediate({
        event_name: "onboarding_completed",
        step: "venue_ratings",
        payload: { via, rated_count: ratedCountSnapshot },
      });
      onComplete();
    },
    [onComplete, trackImmediate],
  );

  const submitRating = useCallback(
    async (rating: number) => {
      if (!current || submitting) return;
      setSubmitting(true);
      setSelectedRating(rating);
      try {
        await upsertRating.mutateAsync({ venueId: current.venue_id, rating });
        const nextCount = ratedCount + 1;
        setRatedCount(nextCount);
        track({ event_name: "venue_rated", step: "venue_ratings", payload: { venue_id: current.venue_id, rating } });
        if (nextCount % 3 === 0) {
          void calculateAffinity.mutateAsync();
        }
        if (nextCount >= MIN_ONBOARDING_VENUE_RATINGS) {
          await calculateAffinity.mutateAsync();
          await finishSession("min_ratings", nextCount);
          return;
        }
        const nextIndex = index + 1;
        if (nextIndex < venues.length) {
          goToIndex(nextIndex);
        } else {
          setOffset((o) => o + 8);
          goToIndex(nextIndex);
        }
      } finally {
        setSubmitting(false);
      }
    },
    [
      calculateAffinity,
      current,
      finishSession,
      goToIndex,
      index,
      ratedCount,
      submitting,
      track,
      upsertRating,
      venues.length,
    ],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .onUpdate((e) => {
          translateX.value = e.translationX;
        })
        .onEnd((e) => {
          if (e.translationX < -SWIPE_THRESHOLD && index < venues.length - 1) {
            runOnJS(goToIndex)(index + 1);
          } else if (e.translationX > SWIPE_THRESHOLD && index > 0) {
            runOnJS(goToIndex)(index - 1);
          }
          translateX.value = withSpring(0);
        }),
    [goToIndex, index, translateX, venues.length],
  );

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const canFinishEarly = ratedCount >= MIN_ONBOARDING_VENUE_RATINGS;

  if (isLoading && venues.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!current && !isLoading) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: colors.text }}>{t("empty", { keyPrefix: "onboarding.venue" })}</Text>
        {canFinishEarly ? (
          <Pressable
            style={[primaryPressableStyle, styles.finishBtn]}
            onPress={() => void finishSession("finish_button", ratedCount)}
          >
            <Text style={primaryPressableTextStyle}>{t("finish", { keyPrefix: "onboarding.actions" })}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        {t("progress", { keyPrefix: "onboarding.venue", count: ratedCount, min: MIN_ONBOARDING_VENUE_RATINGS })}
      </Text>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.deck, cardStyle]}>
          {current ? <OnboardingVenueCard venue={current} /> : null}
        </Animated.View>
      </GestureDetector>
      <View style={styles.bottomControls}>
        <View style={styles.navRow}>
          <Pressable disabled={index === 0} onPress={() => goToIndex(index - 1)} style={styles.navBtn}>
            <Text style={{ color: index === 0 ? colors.textMuted : colors.text }}>{t("prev", { keyPrefix: "onboarding.actions" })}</Text>
          </Pressable>
          <Pressable
            disabled={index >= venues.length - 1}
            onPress={() => goToIndex(index + 1)}
            style={styles.navBtn}
          >
            <Text style={{ color: index >= venues.length - 1 ? colors.textMuted : colors.text }}>
              {t("next", { keyPrefix: "onboarding.actions" })}
            </Text>
          </Pressable>
        </View>
        <RatingScale selected={selectedRating} onSelect={(r) => void submitRating(r)} />
        {canFinishEarly ? (
          <Pressable
            style={[primaryPressableStyle, styles.finishBtn]}
            onPress={() => void finishSession("finish_button", ratedCount)}
          >
            <Text style={primaryPressableTextStyle}>{t("finish", { keyPrefix: "onboarding.actions" })}</Text>
          </Pressable>
        ) : null}
      </View>
      {submitting ? <ActivityIndicator style={styles.spinner} color={colors.primary} /> : null}
    </View>
  );
}

export function OnboardingVenueRatingStep(props: Props) {
  return (
    <PageI18nProvider>
      <OnboardingVenueRatingStepContent {...props} />
    </PageI18nProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0, gap: 12 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  hint: { fontSize: 13, textAlign: "center", flexShrink: 0 },
  deck: { flex: 1, minHeight: 0, alignSelf: "stretch" },
  bottomControls: { flexShrink: 0, gap: 12 },
  navRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8 },
  navBtn: { padding: 8 },
  finishBtn: { marginTop: 4 },
  spinner: { position: "absolute", bottom: 80, alignSelf: "center" },
});
