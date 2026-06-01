import { AppPressable } from "@/shared/ui/app-pressable";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  InteractionManager,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Carousel, { type ICarouselInstance } from "react-native-reanimated-carousel";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import type { HomeStackParamList } from "@/app/navigation/types";
import { navigateToProfileAuth } from "@/app/navigation/navigationHelpers";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { useAuth } from "@/app/providers/AuthProvider";
import { useBusinessCard } from "@/entities/business-card";
import {
  useDailyRecommendations,
  useTrackRecommendationEvent,
  type DailyRecommendation,
} from "@/entities/daily-recommendation";
import {
  DailyRecommendationActionsBar,
  DailyRecommendationSlide,
  useDailyRecommendationActions,
} from "@/features/daily-recommendations";
import { configureDailyRecommendationsCarouselPanGesture } from "@/features/daily-recommendations/lib/configureDailyRecommendationsCarouselPanGesture";
import { dailyRecommendationsCarouselAnimation } from "@/features/daily-recommendations/lib/dailyRecommendationsCarouselAnimation";
import { DAILY_RECOMMENDATION_SLIDE_EDGE_INSET } from "@/features/daily-recommendations/lib/dailyRecommendationsLayout";
import { useSubscriptionGatedNavigation } from "@/features/subscription-paywall-redirect";
import { DirectionsModal } from "@/shared/ui/directions-modal";
import { PageI18nProvider } from "@/shared/lib/i18n";
import { useAndroidFullSwipeBackPanHandlers } from "@/shared/lib/useAndroidFullSwipeBackPanHandlers";

type Nav = NativeStackNavigationProp<HomeStackParamList, "DailyRecommendations">;
type Route = RouteProp<HomeStackParamList, "DailyRecommendations">;

const PAGE_PADDING = 16;
const ANDROID_BACK_SWIPE_EDGE_WIDTH = 24;

function DailyRecommendationsPageContent() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const androidEdgeSwipeBackPanHandlers = useAndroidFullSwipeBackPanHandlers(navigation);
  const goBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);
  const targetDate = route.params?.date;
  const [index, setIndex] = useState(0);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [carouselLayout, setCarouselLayout] = useState({ width: 0, height: 0 });
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const carouselRef = useRef<ICarouselInstance | null>(null);
  const openedOnceRef = useRef(false);

  const { openBookingFlow } = useSubscriptionGatedNavigation(navigation);

  const onCarouselWrapLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setCarouselLayout((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);

  const { data: recommendations = [], isLoading } = useDailyRecommendations(targetDate);
  const trackRecommendationEvent = useTrackRecommendationEvent();

  const visibleRecommendations = useMemo(
    () => recommendations.filter((item) => !dismissedIds.includes(item.venue_id)),
    [dismissedIds, recommendations],
  );

  const slideWidth = Math.max(0, carouselLayout.width);

  const { trackOpen, trackImpression, onBook } = useDailyRecommendationActions({
    isAuthenticated: Boolean(user),
    onOpenBooking: (venueId) => openBookingFlow({ id: venueId }),
    onRequireAuth: () => navigateToProfileAuth(navigation),
    onSharePlace: () => {},
  });

  useEffect(() => {
    if (isLoading || openedOnceRef.current) return;
    openedOnceRef.current = true;
    InteractionManager.runAfterInteractions(() => {
      if (recommendations.length === 0) {
        trackRecommendationEvent.mutate({
          event_name: "daily_recommendations_empty",
          payload: { date: targetDate ?? null },
        });
        return;
      }
      trackRecommendationEvent.mutate({
        event_name: "daily_recommendations_opened",
        payload: { source: "daily_screen", date: targetDate ?? null, count: recommendations.length },
      });
    });
  }, [isLoading, recommendations.length, targetDate, trackRecommendationEvent]);

  useEffect(() => {
    if (visibleRecommendations.length === 0) return;
    const safeIndex = Math.min(index, visibleRecommendations.length - 1);
    if (safeIndex !== index) {
      setIndex(safeIndex);
      carouselRef.current?.scrollTo({ index: safeIndex, animated: true });
      return;
    }
    const activeItem = visibleRecommendations[safeIndex];
    if (activeItem) {
      InteractionManager.runAfterInteractions(() => {
        trackImpression(activeItem);
      });
    }
  }, [index, trackImpression, visibleRecommendations]);

  const handleSnapToItem = useCallback(
    (nextIndex: number) => {
      setIndex(nextIndex);
      const item = visibleRecommendations[nextIndex];
      if (!item) return;
      InteractionManager.runAfterInteractions(() => {
        trackOpen(item);
      });
    },
    [trackOpen, visibleRecommendations],
  );

  const active = visibleRecommendations[index];
  const { data: activePlace } = useBusinessCard(active?.venue_id ?? "");
  const activeAddress = activePlace?.address?.trim() ?? "";

  const renderCarouselItem = useCallback(
    ({ item, index: itemIndex }: { item: DailyRecommendation; index: number }) => (
      <DailyRecommendationSlide
        item={item}
        slideWidth={slideWidth}
        slideHeight={carouselLayout.height}
        slideIndex={itemIndex}
        slideTotal={visibleRecommendations.length}
        addressLine={item.venue_id === active?.venue_id ? activeAddress || null : null}
        accentColor={colors.accent}
        textMutedColor={colors.textMuted}
        reasonCardIconColor={colors.text}
        reasonCardBackground={colors.card}
        reasonCardBorder={colors.border}
        heroLoadingSpinnerColor={colors.primary}
      />
    ),
    [
      active?.venue_id,
      activeAddress,
      carouselLayout.height,
      colors.accent,
      colors.border,
      colors.card,
      colors.primary,
      colors.text,
      colors.textMuted,
      slideWidth,
      visibleRecommendations.length,
    ],
  );

  const pageTitle = t("dailyRecommendations.title", { defaultValue: "Tonight for You" });
  const pageSubtitle = t("dailyRecommendations.subtitle", { defaultValue: "Fresh picks generated for your taste." });

  const header = useMemo(
    () => (
      <View style={[styles.header, styles.contentInset]}>
        <View style={styles.headerTopRow}>
          <AppPressable
            onPress={goBack}
            hitSlop={16}
            style={[styles.backBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
            accessibilityRole="button"
            accessibilityLabel={t("common.goBack", { defaultValue: "Go back" })}
          >
            <Ionicons name="arrow-back" size={18} color={colors.text} />
          </AppPressable>
          <Text style={[styles.headerTitle, { color: colors.text }]} pointerEvents="none" numberOfLines={1}>
            {pageTitle}
          </Text>
        </View>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>{pageSubtitle}</Text>
      </View>
    ),
    [colors.border, colors.card, colors.text, colors.textMuted, goBack, pageSubtitle, pageTitle, t],
  );

  const screenBody = (
    <>
      {header}

      {visibleRecommendations.length > 0 ? (
        <View style={styles.carouselWrap} onLayout={onCarouselWrapLayout}>
          {carouselLayout.width > 0 && carouselLayout.height > 0 && slideWidth > 0 ? (
            <Carousel
              ref={carouselRef}
              width={slideWidth}
              height={carouselLayout.height}
              style={{ width: carouselLayout.width, height: carouselLayout.height }}
              data={visibleRecommendations}
              loop={false}
              windowSize={3}
              withAnimation={dailyRecommendationsCarouselAnimation}
              onConfigurePanGesture={configureDailyRecommendationsCarouselPanGesture}
              onSnapToItem={handleSnapToItem}
              renderItem={renderCarouselItem}
            />
          ) : null}
        </View>
      ) : (
        <View style={[styles.emptyWrap, styles.contentInset]}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {t("dailyRecommendations.empty", { defaultValue: "No picks for today yet. Check back soon." })}
          </Text>
        </View>
      )}

      {active ? (
        <View style={[styles.footer, styles.contentInset]}>
          <DailyRecommendationActionsBar
            colors={colors}
            isDark={isDark}
            bookTitle={t("dailyRecommendations.book", { defaultValue: "Book" })}
            howToGetTitle={t("dailyRecommendations.howToGet", { defaultValue: "How to get" })}
            onBook={() => onBook(active)}
            onHowToGet={() => setDirectionsOpen(true)}
            bottomInset={insets.bottom}
          />
        </View>
      ) : null}

      {active ? (
        <DirectionsModal
          visible={directionsOpen}
          onClose={() => setDirectionsOpen(false)}
          placeName={active.name}
          address={activeAddress}
        />
      ) : null}
    </>
  );

  const screenShell = (body: ReactNode) => (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + PAGE_PADDING }]}>
      {body}
      {Platform.OS === "android" ? (
        <View style={styles.androidBackSwipeEdge} {...androidEdgeSwipeBackPanHandlers} />
      ) : null}
    </View>
  );

  if (isLoading) {
    return screenShell(
      <>
        {header}
        <View style={[styles.loadingWrap, styles.contentInset]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>,
    );
  }

  return screenShell(screenBody);
}

export default function DailyRecommendationsPage() {
  return (
    <PageI18nProvider>
      <DailyRecommendationsPageContent />
    </PageI18nProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: PAGE_PADDING,
  },
  contentInset: {
    paddingHorizontal: DAILY_RECOMMENDATION_SLIDE_EDGE_INSET,
  },
  header: {
    marginBottom: 12,
  },
  headerTopRow: {
    position: "relative",
    minHeight: 40,
    justifyContent: "center",
    zIndex: 2,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
  },
  headerTitle: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 28,
    fontWeight: "800",
    zIndex: 1,
  },
  subtitle: { marginTop: 6, fontSize: 14, lineHeight: 20 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  carouselWrap: { flex: 1, minHeight: 0 },
  footer: { marginTop: 12 },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { textAlign: "center", fontSize: 15, lineHeight: 22 },
  androidBackSwipeEdge: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: ANDROID_BACK_SWIPE_EDGE_WIDTH,
    zIndex: 20,
  },
});
