import { AppPressable } from "@/shared/ui/app-pressable";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Text, View, StyleSheet, type LayoutChangeEvent } from "react-native";
import { useTranslation } from "react-i18next";
import Carousel, { type ICarouselInstance } from "react-native-reanimated-carousel";
import Animated, { Easing, useSharedValue, withTiming, useAnimatedStyle } from "react-native-reanimated";
import type { PanGesture } from "react-native-gesture-handler";
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
import { ShimmerProvider, ShimmerSurface } from "@/shared/ui/shimmer";
import { useStaticWindowSize } from "@/shared/lib/useStaticWindowSize";

const SLIDE_ANIMATION = {
  type: "timing" as const,
  config: { duration: 380, easing: Easing.out(Easing.cubic) },
};

function configureVenueCarouselPanGesture(pan: PanGesture) {
  "worklet";
  pan.activeOffsetX([-10, 10]);
  pan.failOffsetY([-10, 10]);
}

/** PreferenceOnboardingPage paddingHorizontal (20×2) + slide marginHorizontal (3×2) */
const CARD_HORIZONTAL_INSET = 46;

function OnboardingVenueCardSkeleton() {
  const { colors } = useAppTheme();
  const { width: windowWidth } = useStaticWindowSize();
  const w = windowWidth - CARD_HORIZONTAL_INSET;

  return (
    <ShimmerProvider active>
      <View style={[skeletonStyles.card, { backgroundColor: colors.card }]}>
        <ShimmerSurface width={w} height={168} />
        <View style={skeletonStyles.body}>
          <ShimmerSurface width={Math.round(w * 0.68)} height={22} borderRadius={4} />
          <ShimmerSurface width={Math.round(w * 0.42)} height={14} borderRadius={4} />
          <ShimmerSurface width={Math.round(w * 0.52)} height={14} borderRadius={4} />
          <View style={skeletonStyles.tags}>
            <ShimmerSurface width={80} height={26} borderRadius={12} />
            <ShimmerSurface width={96} height={26} borderRadius={12} />
            <ShimmerSurface width={68} height={26} borderRadius={12} />
          </View>
          <ShimmerSurface width={Math.round(w * 0.88)} height={14} borderRadius={4} />
          <ShimmerSurface width={Math.round(w * 0.72)} height={14} borderRadius={4} />
          <ShimmerSurface width={Math.round(w * 0.60)} height={14} borderRadius={4} />
        </View>
      </View>
    </ShimmerProvider>
  );
}

const skeletonStyles = StyleSheet.create({
  card: { flex: 1, borderRadius: 20, overflow: "hidden" },
  body: { padding: 16, gap: 8 },
  tags: { flexDirection: "row", gap: 6 },
});

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
  const [deckSize, setDeckSize] = useState({ width: 0, height: 0 });
  const carouselRef = useRef<ICarouselInstance>(null);

  const carouselOpacity = useSharedValue(0);
  const carouselAnimStyle = useAnimatedStyle(() => ({ opacity: carouselOpacity.value }));

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
    carouselOpacity.value = 0;
    carouselRef.current?.scrollTo({ index: 0, animated: false });
  }, [prefsFingerprint]);

  // Fade in carousel once deck is measured and first batch of venues is ready
  useEffect(() => {
    if (deckSize.width > 0 && deckSize.height > 0 && venues.length > 0) {
      carouselOpacity.value = withTiming(1, { duration: 280 });
    }
  }, [deckSize.width, deckSize.height, venues.length]);

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

  useEffect(() => {
    if (index >= venues.length - 3 && page.length > 0) {
      setOffset((o) => o + 8);
    }
  }, [index, venues.length, page.length]);

  const current = venues[index];

  const goToIndex = useCallback((next: number) => {
    carouselRef.current?.scrollTo({ index: next, animated: true });
  }, []);

  const handleSnapToItem = useCallback((nextIndex: number) => {
    setIndex(nextIndex);
    setSelectedRating(null);
  }, []);

  const onDeckLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setDeckSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);

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

  const renderCarouselItem = useCallback(
    ({ item }: { item: OnboardingVenue | undefined }) => (
      <View style={styles.slide}>
        {item ? <OnboardingVenueCard venue={item} /> : <OnboardingVenueCardSkeleton />}
      </View>
    ),
    [],
  );

  const canFinishEarly = ratedCount >= MIN_ONBOARDING_VENUE_RATINGS;

  if (!current && !isLoading && venues.length > 0) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: colors.text }}>{t("empty", { keyPrefix: "onboarding.venue" })}</Text>
        {canFinishEarly ? (
          <AppPressable
            style={[primaryPressableStyle, styles.finishBtn]}
            onPress={() => void finishSession("finish_button", ratedCount)}
          >
            <Text style={primaryPressableTextStyle}>{t("finish", { keyPrefix: "onboarding.actions" })}</Text>
          </AppPressable>
        ) : null}
      </View>
    );
  }

  // Single layout tree: skeleton is shown until deckSize is measured + venues arrive,
  // then the carousel fades in over the skeleton position. onLayout is always attached
  // so deckSize is ready before venues finish loading.
  const carouselReady = deckSize.width > 0 && deckSize.height > 0 && venues.length > 0;

  return (
    <View style={styles.root}>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        {t("progress", { keyPrefix: "onboarding.venue", count: ratedCount, min: MIN_ONBOARDING_VENUE_RATINGS })}
      </Text>
      <View style={styles.deckWrap} onLayout={onDeckLayout}>
        {!carouselReady ? (
          <OnboardingVenueCardSkeleton />
        ) : (
          <Animated.View style={[StyleSheet.absoluteFill, carouselAnimStyle]}>
            <Carousel
              ref={carouselRef}
              data={venues}
              width={deckSize.width}
              height={deckSize.height}
              loop={false}
              defaultIndex={0}
              windowSize={3}
              withAnimation={SLIDE_ANIMATION}
              onConfigurePanGesture={configureVenueCarouselPanGesture}
              onSnapToItem={handleSnapToItem}
              renderItem={renderCarouselItem}
            />
          </Animated.View>
        )}
      </View>
      <View style={styles.bottomControls}>
        <View style={styles.navRow}>
          <AppPressable disabled={index === 0} onPress={() => goToIndex(index - 1)} style={styles.navBtn}>
            <Text style={{ color: index === 0 ? colors.textMuted : colors.text }}>
              {t("prev", { keyPrefix: "onboarding.actions" })}
            </Text>
          </AppPressable>
          <AppPressable
            disabled={index >= venues.length - 1}
            onPress={() => goToIndex(index + 1)}
            style={styles.navBtn}
          >
            <Text style={{ color: index >= venues.length - 1 ? colors.textMuted : colors.text }}>
              {t("next", { keyPrefix: "onboarding.actions" })}
            </Text>
          </AppPressable>
        </View>
        <RatingScale selected={selectedRating} onSelect={(r) => void submitRating(r)} />
        {canFinishEarly ? (
          <AppPressable
            style={[primaryPressableStyle, styles.finishBtn]}
            onPress={() => void finishSession("finish_button", ratedCount)}
          >
            <Text style={primaryPressableTextStyle}>{t("finish", { keyPrefix: "onboarding.actions" })}</Text>
          </AppPressable>
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
  deckWrap: { flex: 1, minHeight: 0 },
  slide: { flex: 1, marginHorizontal: 3 },
  bottomControls: { flexShrink: 0, gap: 12 },
  navRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8 },
  navBtn: { padding: 8 },
  finishBtn: { marginTop: 4 },
  spinner: { position: "absolute", bottom: 80, alignSelf: "center" },
});
