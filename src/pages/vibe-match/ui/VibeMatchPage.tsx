import { AppPressable } from "@/shared/ui/app-pressable";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import {
  View,
  Text,
  TextInput,
  ActivityIndicator,
  Alert,
  PixelRatio,
  InteractionManager,
  ScrollView,
  Platform,
} from "react-native";
import { useScrollToFocusedInput } from "@/shared/lib/keyboard";
import { FontAwesome6, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CommonActions, useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BrowseFlowParamList } from "@/app/navigation/types";
import { useQueries } from "@tanstack/react-query";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";
import { vibeMatchStaticStyles, vibeMatchThemeStyles } from "./vibeMatchStyles";
import type { TravelMode } from "@/shared/lib/directionsApi";
import { VibeRouteMap } from "./VibeRouteMap";
import { VibeRouteMapSkeleton } from "./VibeRouteMapSkeleton";
import { VibeGenerationPulse } from "./VibeGenerationPulse";
import { useVibePlanMapPoints } from "../lib/useVibePlanMapPoints";
import { useVibePlanRoute } from "../lib/useVibePlanRoute";
import { filterBookableVibePlanStops } from "../lib/filterBookableVibePlanStops";
import { useDebouncedVibeRouteSelection } from "../lib/useDebouncedVibeRouteSelection";
import { useInitialVibeRouteMapReady } from "../lib/useInitialVibeRouteMapReady";
import { useAuth } from "@/app/providers/AuthProvider";
import { useAuthSessionRedirect } from "@/features/auth-session-redirect";
import {
  shouldEnforceSubscriptionPaywall,
  useSubscriptionPaywallRedirect,
} from "@/features/subscription-paywall-redirect";
import { isInsufficientBookingCreditsError } from "@/entities/booking-credits";
import { useBookingAccess } from "@/features/booking-access";
import { BookingCreditsBadge } from "@/shared/ui/booking-credits-badge/BookingCreditsBadge";
import { appAlert } from "@/shared/ui/app-popup";
import { useProfile } from "@/entities/user";
import { usePixAI, type PixAIVibeTimeline, type VibePlanStop, type PixAISlot } from "@/entities/pixai";
import { buildVibeRouteAssistantMessage } from "@/entities/pixai/lib/buildVibeRouteAssistantMessage";
import {
  formatVibeSlotTimeLabel,
  isTimeSlotBookableNow,
  isTimeSlotInWindowContext,
  normalizeVibePlanStopsForContext,
  snapIsoToThirtyMinuteGridForContext,
  VIBE_BOOKING_SLOT_MATCH_MS,
  type VibeTimeWindowContext,
} from "@/entities/pixai/lib/vibeBookingWindow";
import { fetchAvailableSlotsForDay, useCreateBooking } from "@/entities/booking";
import { useCreateCartItem } from "@/entities/cart";
import { normalizeWaInterfaceLocale, startN8nWaBooking } from "@/entities/cart";
import { i18n, PageI18nProvider } from "@/shared/lib/i18n";
import { isAuthRequiredError, navigateToAuthScreen } from "@/shared/lib/auth/authRequired";
import {
  BookingProfileCompleteTip,
  showGuestFormValidationPopup,
  showMissingBookingSlotPopup,
  type GuestFormFieldError,
} from "@/features/booking-personal-data-notice";
import { isPersonalDataComplete } from "@/shared/lib/profileCompletion";
import {
  ALL_CITIES_OPTION,
  useAvailableCities,
  groupCitiesByCountry,
  filterCityGroups,
} from "@/entities/business-card";
import { BottomSheetPickerModal } from "@/shared/ui/bottom-sheet-picker/BottomSheetPickerModal";
import {
  PhoneInput,
  DEFAULT_PHONE_VALUE,
  parseStoredPhone,
  serializePhone,
  validatePhoneValue,
  type PhoneValue,
} from "@/shared/ui/phone-input";
import {
  SHARED_PRESSABLE_HEIGHT,
  SHARED_PRESSABLE_RADIUS,
  primaryPressableStyle,
  primaryPressableTextStyle,
} from "@/shared/theme/primaryPressable";
import { PLACE_IMAGE_FALLBACK } from "@/shared/assets/placeImageFallback";
import { getPrimaryBusinessCardImage } from "@/shared/lib/business-card/businessCardImages";
import {
  businessCardDisplayFallback,
  getBusinessCardDisplayUrl,
} from "@/shared/lib/business-card/businessCardDisplayUrl";
import { toYmd } from "@/shared/lib/bookingCalendar";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { useAndroidFullSwipeBackPanHandlers } from "@/shared/lib/useAndroidFullSwipeBackPanHandlers";
import { useDisableGestureDuringTransition } from "@/shared/lib/navigation/useDisableGestureDuringTransition";
import { VIBE_OPTIONS, type TaxonomyOption } from "@/entities/user-preferences";
import { LinearGradient } from "expo-linear-gradient";
import { VibeMoodCards } from "./VibeMoodCards";
import { VibeTimelineSelector } from "./VibeTimelineSelector";
import { VibeCustomTimeWindowSlider } from "./VibeCustomTimeWindowSlider";
import { inferSearchTimelineFromSelection, buildVibeTimeWindowContext, type VibeAppliedTimeSelection, type VibeCustomTimeWindow, type VibeTimeSelectionMode } from "../lib/vibeTimeSelection";
import { createCustomTimeWindowAxis } from "../lib/customTimeWindowAxis";
import { ctaGradientColors } from "@/shared/theme/gradients";
import { devWarn } from "@/shared/lib/devLog";
import Toast from "react-native-toast-message";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VIBE_MATCH_MOOD_OPTIONS: TaxonomyOption[] = VIBE_OPTIONS.map((option) => ({
  ...option,
  labelPrefix: "vibeMatch.vibes",
}));

const SLOT_MATCH_MS = VIBE_BOOKING_SLOT_MATCH_MS;
const PLAN_THUMB_SIZE = 80;
const MAX_SUGGESTED_VENUES = 4;
const DEFAULT_CUSTOM_WINDOW = { startMinutes: 17 * 60, endMinutes: 22 * 60 };
function formatStopAddress(stop: VibePlanStop): string | null {
  const address = stop.address?.trim();
  const city = stop.city?.trim();
  if (address && city && !address.toLowerCase().includes(city.toLowerCase())) {
    return `${address}, ${city}`;
  }
  return address || city || null;
}

function resolveStopActivityLabel(
  stop: VibePlanStop,
  index: number,
  total: number,
  t: (key: string) => string,
): string {
  const hour = new Date(stop.time_slot).getHours();
  if (index === total - 1 && total > 1) return t("vibeMatch.stopActivity.afterParty");
  if (hour >= 22 || hour < 2) return t("vibeMatch.stopActivity.afterParty");
  if (hour >= 20 || index > 0) return t("vibeMatch.stopActivity.afterParty");
  return t("vibeMatch.stopActivity.dinner");
}

function resolveStopCategoryLabel(
  stop: VibePlanStop,
  index: number,
  total: number,
  t: (key: string) => string,
): string {
  if (stop.is_restaurant_table) return t("vibeMatch.stopCategory.restaurant");
  if (index === total - 1 && total > 1) return t("vibeMatch.stopCategory.club");
  return t("vibeMatch.stopCategory.bar");
}

function vibeStopThumbUris(images: string[] | undefined): { uri: string | null; fallbackUri: string | null } {
  const raw = getPrimaryBusinessCardImage(images ?? []);
  if (!raw) return { uri: null, fallbackUri: null };
  const edge = Math.round(PLAN_THUMB_SIZE * Math.min(2, PixelRatio.get()));
  const uri = getBusinessCardDisplayUrl(raw, { layoutPx: edge, layoutPxHeight: edge });
  return { uri, fallbackUri: businessCardDisplayFallback(uri, raw) ?? null };
}

function scheduleN8nWaBookingStart(cartItemId: string, accessToken: string) {
  void startN8nWaBooking(cartItemId, accessToken, normalizeWaInterfaceLocale(i18n.language)).then((result) => {
    if (!result.ok) {
      devWarn("[n8n-wa-booking-start] invoke failed", result.message);
    }
  });
}

/** Closest available slot to proposed time within one booking grid step; otherwise null. */
function resolveBookingDateTime(
  slots: PixAISlot[],
  proposedIso: string,
  timeWindow: VibeTimeWindowContext,
): string | null {
  const t = new Date(snapIsoToThirtyMinuteGridForContext(proposedIso, timeWindow)).getTime();
  let best: PixAISlot | null = null;
  let bestDist = Infinity;
  for (const s of slots) {
    if (!s.available) continue;
    if (!isTimeSlotInWindowContext(s.dateTimeIso, timeWindow)) continue;
    const d = Math.abs(new Date(s.dateTimeIso).getTime() - t);
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  if (best && bestDist <= SLOT_MATCH_MS) return best.dateTimeIso;
  return null;
}

type VibeBookingAction = "all" | "partial" | "retry";

type BookRowResult = { stop: VibePlanStop; ok: true } | { stop: VibePlanStop; ok: false; message: string };

type Nav = NativeStackNavigationProp<BrowseFlowParamList, "VibeMatch">;

function VibeMatchPageContent() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const navigation = useNavigation<Nav>();
  useDisableGestureDuringTransition();
  const androidSwipeBackPanHandlers = useAndroidFullSwipeBackPanHandlers(navigation);
  const { user, session, loading: authLoading } = useAuth();
  const {
    canAccessVibeMatch,
    isLoading: accessLoading,
    balance,
    bookingSelectionLimit,
    exemptFromBookingCredits,
    isIntroActive,
    introPeriodEndsAt,
    hasPaidPremium,
    canUseBookingCredits,
  } = useBookingAccess();
  const shouldEnforcePaywall = shouldEnforceSubscriptionPaywall();

  useAuthSessionRedirect({
    authLoading,
    hasUser: Boolean(user),
    navigation,
  });

  const { data: profile } = useProfile();
  const { data: availableCities = [ALL_CITIES_OPTION] } = useAvailableCities();
  const { runVibePlan, isVibeLoading, vibeResult, vibeError, resetVibePlan } = usePixAI();
  useSubscriptionPaywallRedirect({
    accessLoading,
    shouldEnforcePaywall,
    hasAccess: canAccessVibeMatch || Boolean(vibeResult),
    paywallReason: !canUseBookingCredits ? "no_credits" : "upgrade",
    navigation: navigation as {
      replace: (name: "SubscriptionPaywall", params?: { reason?: "no_credits" | "upgrade" }) => void;
    },
  });
  const createBooking = useCreateBooking();
  const createCartItem = useCreateCartItem();

  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [mood, setMood] = useState("");
  const [timeline, setTimeline] = useState<PixAIVibeTimeline>("evening");
  const [timeSelectionMode, setTimeSelectionMode] = useState<VibeTimeSelectionMode>("preset");
  const [customTimeWindow, setCustomTimeWindow] = useState(() =>
    createCustomTimeWindowAxis().normalizeCustomTimeWindow(DEFAULT_CUSTOM_WINDOW),
  );
  const [appliedTimeSelection, setAppliedTimeSelection] = useState<VibeAppliedTimeSelection | null>(null);
  const [city, setCity] = useState("");
  const [cityPickerVisible, setCityPickerVisible] = useState(false);
  const [citySearchQuery, setCitySearchQuery] = useState("");
  const [persons, setPersons] = useState("2");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState<PhoneValue>(DEFAULT_PHONE_VALUE);
  const [customerEmail, setCustomerEmail] = useState("");
  const [comment, setComment] = useState("");
  const [lastBookResults, setLastBookResults] = useState<BookRowResult[] | null>(null);
  const [bookingAction, setBookingAction] = useState<VibeBookingAction | null>(null);
  const [selectedVenueIds, setSelectedVenueIds] = useState<string[]>([]);
  const [lastVibeContext, setLastVibeContext] = useState<{
    mood: string;
    timeWindow: VibeTimeWindowContext;
    city: string;
  } | null>(null);
  const selectionSeededForPlanRef = useRef("");
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  const { onInputFocus, onScroll: onKeyboardScroll } = useScrollToFocusedInput(scrollRef, {
    scrollOffsetYRef: scrollYRef,
  });
  const personsInputRef = useRef<TextInput>(null);
  const customerNameInputRef = useRef<TextInput>(null);
  const phoneInputRef = useRef<TextInput>(null);
  const customerEmailInputRef = useRef<TextInput>(null);
  const commentInputRef = useRef<TextInput>(null);
  const handleGuestInputFocus = useCallback(
    (fieldRef: RefObject<TextInput | null>) => {
      onInputFocus(fieldRef);
    },
    [onInputFocus],
  );
  const conciergeScrollYRef = useRef(0);
  const pendingScrollToConciergeRef = useRef(false);
  const bookingBusy = bookingAction !== null;

  const scrollToConciergeTop = useCallback(() => {
    if (!pendingScrollToConciergeRef.current) return;
    const y = conciergeScrollYRef.current;
    if (y <= 0) return;
    pendingScrollToConciergeRef.current = false;
    scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: true });
  }, []);

  const scheduleScrollToConcierge = useCallback(() => {
    if (!pendingScrollToConciergeRef.current || !vibeResult || isVibeLoading) return;
    const task = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        scrollToConciergeTop();
        if (pendingScrollToConciergeRef.current) {
          requestAnimationFrame(scrollToConciergeTop);
        }
      });
    });
    return () => task.cancel();
  }, [isVibeLoading, scrollToConciergeTop, vibeResult]);

  useEffect(() => {
    return scheduleScrollToConcierge();
  }, [vibeResult, isVibeLoading, scheduleScrollToConcierge]);

  useFocusEffect(
    useCallback(() => {
      const y = scrollYRef.current;
      if (y <= 0) return undefined;
      const task = InteractionManager.runAfterInteractions(() => {
        requestAnimationFrame(() => {
          scrollRef.current?.scrollTo({ y, animated: false });
        });
      });
      return () => task.cancel();
    }, []),
  );

  const draftTimeSelection = useMemo<VibeAppliedTimeSelection>(
    () => ({
      mode: timeSelectionMode,
      timeline,
      customWindow: customTimeWindow,
    }),
    [customTimeWindow, timeSelectionMode, timeline],
  );

  const draftTimeWindowContext = useMemo(
    () => buildVibeTimeWindowContext(draftTimeSelection),
    [draftTimeSelection],
  );

  const appliedTimeWindowContext = useMemo(
    () =>
      appliedTimeSelection
        ? buildVibeTimeWindowContext(appliedTimeSelection)
        : draftTimeWindowContext,
    [appliedTimeSelection, draftTimeWindowContext],
  );

  const searchTimeline = useMemo(
    () => inferSearchTimelineFromSelection(draftTimeSelection),
    [draftTimeSelection],
  );

  const plan = useMemo(
    () => normalizeVibePlanStopsForContext(vibeResult?.plan ?? [], appliedTimeWindowContext),
    [appliedTimeWindowContext, vibeResult?.plan],
  );
  const [routeTravelMode, setRouteTravelMode] = useState<TravelMode>("driving");
  const planSelectionKey = useMemo(
    () => plan.map((s) => `${s.venue_id}:${s.time_slot}`).join("|"),
    [plan],
  );

  const concreteCities = useMemo(
    () => availableCities.filter((c) => c !== ALL_CITIES_OPTION),
    [availableCities],
  );

  const filteredCityGroups = useMemo(() => {
    const grouped = groupCitiesByCountry(concreteCities);
    return filterCityGroups(grouped, citySearchQuery);
  }, [concreteCities, citySearchQuery]);

  useEffect(() => {
    const c = profile?.city?.trim();
    if (c) setCity((prev) => (prev.trim() ? prev : c));
  }, [profile?.city]);

  useEffect(() => {
    if (!profile) return;
    const defaultFullName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
    const defaultPhone = parseStoredPhone(profile.phone);
    const defaultEmail = (profile.email ?? "").trim();
    setCustomerName((prev) => (prev.trim() ? prev : defaultFullName));
    setCustomerPhone((prev) => (prev.nationalDigits ? prev : defaultPhone));
    setCustomerEmail((prev) => (prev.trim() ? prev : defaultEmail));
  }, [profile]);

  const slotQueries = useQueries({
    queries: plan.map((stop) => {
      const ymd = toYmd(new Date(stop.time_slot));
      return {
        queryKey: queryKeys.availableSlots.forDay(stop.venue_id, ymd),
        queryFn: () => fetchAvailableSlotsForDay(stop.venue_id, ymd),
        enabled: plan.length > 0,
      };
    }),
  });

  const stopAvailability = useMemo(() => {
    return plan.map((stop, i) => {
      const q = slotQueries[i];
      const slots = q?.data ?? [];
      const dateTime = resolveBookingDateTime(slots, stop.time_slot, appliedTimeWindowContext);
      return {
        loading: Boolean(q?.isPending),
        error: Boolean(q?.isError),
        bookable: dateTime != null && isTimeSlotBookableNow(dateTime),
        dateTime,
        slots,
      };
    });
  }, [appliedTimeWindowContext, plan, slotQueries]);

  const slotsAvailabilityReady =
    plan.length > 0 && !stopAvailability.some((x) => x.loading);

  const bookableRouteStops = useMemo(
    () =>
      slotsAvailabilityReady ? filterBookableVibePlanStops(plan, stopAvailability, appliedTimeWindowContext) : [],
    [appliedTimeWindowContext, plan, stopAvailability, slotsAvailabilityReady],
  );

  const bookablePlan = useMemo(
    () => bookableRouteStops.map((item) => item.stop),
    [bookableRouteStops],
  );

  const suggestedPlan = useMemo(
    () => bookablePlan.slice(0, MAX_SUGGESTED_VENUES),
    [bookablePlan],
  );

  const suggestedPlanKey = useMemo(
    () => suggestedPlan.map((s) => `${s.venue_id}:${s.time_slot}`).join("|"),
    [suggestedPlan],
  );

  const isSingleStopRoute = suggestedPlan.length === 1;

  const {
    routePlanStops,
    isRebuildPending,
    syncRouteSelectionNow,
    resetRouteSelection,
  } = useDebouncedVibeRouteSelection(suggestedPlan, selectedVenueIds);

  const conciergeMessage = useMemo(() => {
    if (!lastVibeContext || !vibeResult) return "";
    const stopCount = slotsAvailabilityReady ? suggestedPlan.length : plan.length;
    return buildVibeRouteAssistantMessage(
      {
        ...lastVibeContext,
        stopCount,
      },
      t,
    );
  }, [lastVibeContext, vibeResult, suggestedPlan.length, plan.length, slotsAvailabilityReady, t, i18n.language]);

  const suggestedVenueIds = useMemo(
    () => suggestedPlan.map((s) => s.venue_id),
    [suggestedPlan],
  );

  useEffect(() => {
    if (planSelectionKey === selectionSeededForPlanRef.current) return;
    selectionSeededForPlanRef.current = "";
    setSelectedVenueIds([]);
    setRouteTravelMode("driving");
    resetRouteSelection();
  }, [planSelectionKey, resetRouteSelection]);

  useEffect(() => {
    if (exemptFromBookingCredits) return;
    setSelectedVenueIds((prev) =>
      prev.length <= bookingSelectionLimit ? prev : prev.slice(0, bookingSelectionLimit),
    );
  }, [bookingSelectionLimit, exemptFromBookingCredits]);

  useEffect(() => {
    if (!slotsAvailabilityReady || suggestedVenueIds.length === 0) return;
    if (selectionSeededForPlanRef.current === suggestedPlanKey) return;
    selectionSeededForPlanRef.current = suggestedPlanKey;
    const initial = suggestedVenueIds.slice(0, Math.max(0, bookingSelectionLimit));
    setSelectedVenueIds(initial);
    syncRouteSelectionNow(initial);
  }, [
    suggestedPlanKey,
    suggestedVenueIds,
    bookingSelectionLimit,
    slotsAvailabilityReady,
    syncRouteSelectionNow,
  ]);

  const selectedVenueIdSet = useMemo(() => new Set(selectedVenueIds), [selectedVenueIds]);

  const { points: routeMapPoints, isLoading: routeMapLoading, missingCount: routeMapMissingCount } =
    useVibePlanMapPoints(routePlanStops);
  const {
    polylineCoords: routePolylineCoords,
    isLoadingDirections: routeDirectionsLoading,
    durationText: routeDurationText,
    distanceText: routeDistanceText,
    usesStraightFallback: routeUsesStraightFallback,
  } = useVibePlanRoute(routeMapPoints, routeTravelMode);

  const initialRouteMapReady = useInitialVibeRouteMapReady({
    planSelectionKey: suggestedPlanKey,
    routePlanStopsCount: routePlanStops.length,
    routeMapLoading,
    routeMapPointsCount: routeMapPoints.length,
    routeDirectionsLoading,
  });

  const isRouteUpdating =
    !isSingleStopRoute &&
    (isRebuildPending ||
      routeMapLoading ||
      (routeDirectionsLoading && routePlanStops.length >= 2));
  const showRouteRebuildLabel =
    !isSingleStopRoute &&
    (isRebuildPending || (routeDirectionsLoading && routePlanStops.length >= 2));

  const bookableRouteStopByVenueId = useMemo(
    () => new Map(bookableRouteStops.map((item) => [item.stop.venue_id, item])),
    [bookableRouteStops],
  );

  const selectedBookableStops = useMemo(
    () =>
      suggestedPlan.filter((stop) => {
        if (!selectedVenueIdSet.has(stop.venue_id)) return false;
        return bookableRouteStopByVenueId.get(stop.venue_id)?.meta.bookable === true;
      }),
    [bookableRouteStopByVenueId, selectedVenueIdSet, suggestedPlan],
  );

  const showProfileCompleteTip = !isPersonalDataComplete(profile);
  const bookAllEnabled = selectedBookableStops.length > 0;
  const showPaywallCta = !exemptFromBookingCredits && !canUseBookingCredits;
  const showCreditsLimitInfo =
    !exemptFromBookingCredits &&
    !showPaywallCta &&
    balance > 0 &&
    selectedVenueIds.length === balance &&
    suggestedPlan.length > 0 &&
    slotsAvailabilityReady;

  const openSubscriptionPaywall = useCallback(
    (reason: "no_credits" | "upgrade" = "no_credits") => {
      navigation.navigate("SubscriptionPaywall", { reason });
    },
    [navigation],
  );

  const selectionSeededForCurrentPlan = selectionSeededForPlanRef.current === suggestedPlanKey;
  const showSelectionWarning =
    !isSingleStopRoute &&
    slotsAvailabilityReady &&
    initialRouteMapReady &&
    !isRouteUpdating &&
    selectionSeededForCurrentPlan &&
    suggestedVenueIds.length > 1 &&
    selectedBookableStops.length === 0;

  const showInsufficientCreditsToast = useCallback(
    (requiredCount: number) => {
      Toast.show({
        type: "error",
        text1: t("bookingCredits.noCreditsTitle"),
        text2: t("bookingCredits.insufficientForStops", { count: requiredCount }),
      });
    },
    [t],
  );

  const toggleVenueSelection = useCallback(
    (venueId: string, bookable: boolean) => {
      if (!bookable) return;
      setSelectedVenueIds((prev) => {
        if (prev.includes(venueId)) return prev.filter((id) => id !== venueId);
        if (prev.length >= bookingSelectionLimit) {
          showInsufficientCreditsToast(prev.length + 1);
          return prev;
        }
        return [...prev, venueId];
      });
    },
    [bookingSelectionLimit, showInsufficientCreditsToast],
  );

  const themed = useThemeStyles(
    ({ colors: c }) => vibeMatchThemeStyles(c, insets.top, insets.bottom),
    [insets.top, insets.bottom],
  );
  const styles = useMemo(() => mergeStaticAndThemed(vibeMatchStaticStyles, themed), [themed]);

  const handleCustomWindowChange = useCallback((nextWindow: VibeCustomTimeWindow) => {
    setTimeSelectionMode("custom");
    setCustomTimeWindow(nextWindow);
  }, []);

  const handleTimelineChange = useCallback((nextTimeline: PixAIVibeTimeline) => {
    setTimeSelectionMode("preset");
    setTimeline(nextTimeline);
  }, []);

  const toggleMood = useCallback((id: string) => {
    setSelectedMoods((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  /** Slug ids for search_by_vibe (calm, energetic, …) — not localized labels. */
  const resolveMoodSlugs = useCallback(() => {
    const parts = [...selectedMoods];
    const notes = mood.trim();
    if (notes) parts.push(notes);
    return parts.join(",");
  }, [mood, selectedMoods]);

  const resolveMoodDisplay = useCallback(() => {
    const labels = selectedMoods.map((id) => t(id, { keyPrefix: "vibeMatch.vibes" }));
    const notes = mood.trim();
    if (notes) labels.push(notes);
    return labels.join(", ");
  }, [mood, selectedMoods, t]);

  const onGenerate = useCallback(async () => {
    const moodSlugs = resolveMoodSlugs();
    if (!moodSlugs) {
      Alert.alert(t("vibeMatch.moodAlertTitle"), t("vibeMatch.moodRequired"));
      return;
    }
    const cityTrim = city.trim();
    if (!cityTrim) {
      Alert.alert(t("vibeMatch.cityLabel"), t("vibeMatch.cityRequiredMessage"));
      return;
    }
    setLastBookResults(null);
    setSelectedVenueIds([]);
    setAppliedTimeSelection(draftTimeSelection);
    setLastVibeContext({ mood: resolveMoodDisplay(), timeWindow: draftTimeWindowContext, city: cityTrim });
    try {
      await runVibePlan({ mood: moodSlugs, timeline: searchTimeline, city: cityTrim, limit: MAX_SUGGESTED_VENUES });
      pendingScrollToConciergeRef.current = true;
    } catch {
      pendingScrollToConciergeRef.current = false;
      /* surfaced via vibeError */
    }
  }, [city, draftTimeSelection, draftTimeWindowContext, resolveMoodDisplay, resolveMoodSlugs, runVibePlan, searchTimeline, t]);

  const onClearPlan = useCallback(() => {
    resetVibePlan();
    setLastVibeContext(null);
    setAppliedTimeSelection(null);
  }, [resetVibePlan]);

  const onRetryGenerate = useCallback(() => {
    void onGenerate();
  }, [onGenerate]);

  const getGuestFormError = useCallback((): GuestFormFieldError | null => {
    const p = Number(persons);
    if (!Number.isFinite(p) || p < 1) return "partySize";
    if (!customerName.trim()) return "name";
    if (validatePhoneValue(customerPhone) !== null) return "phone";
    if (!EMAIL_REGEX.test(customerEmail.trim())) return "email";
    return null;
  }, [customerEmail, customerName, customerPhone, persons]);

  const runBookStops = useCallback(
    async (stops: VibePlanStop[], action: VibeBookingAction) => {
      if (bookingAction !== null) return;
      const formError = getGuestFormError();
      if (formError) {
        showGuestFormValidationPopup({ error: formError, t });
        return;
      }
      if (!exemptFromBookingCredits && balance < stops.length) {
        showInsufficientCreditsToast(stops.length);
        return;
      }
      const stopWithoutSlot = stops.find((stop) => {
        const stopIndex = plan.findIndex((item) => item.venue_id === stop.venue_id);
        return stopIndex < 0 || !stopAvailability[stopIndex]?.dateTime;
      });
      if (stopWithoutSlot) {
        showMissingBookingSlotPopup(t);
        return;
      }
      setBookingAction(action);
      try {
        const results: BookRowResult[] = [];
        const p = Number(persons);
        const phoneToSave = serializePhone(customerPhone);
        const accessToken = session?.access_token;
        for (const stop of stops) {
          const i = plan.findIndex((x) => x.venue_id === stop.venue_id);
          if (i < 0) continue;
          const meta = stopAvailability[i];
          const dateTime = meta?.dateTime;
          if (!dateTime) {
            results.push({ stop, ok: false, message: t("vibeMatch.noSlotNearTime") });
            continue;
          }
          const price = Number(stop.booking_price ?? 0);
          try {
            await createBooking.mutateAsync({
              business_card_id: stop.venue_id,
              date_time: dateTime,
              cost: price,
              persons: p,
              customer_name: customerName.trim(),
              customer_phone: phoneToSave,
              customer_email: customerEmail.trim(),
              comment: comment.trim() || null,
              payment_status: "pending",
              status: "upcoming",
            });
            const createdCartItem = await createCartItem.mutateAsync({
              business_card_id: stop.venue_id,
              date_time: dateTime,
              cost: price,
              persons: p,
              customer_name: customerName.trim(),
              customer_phone: phoneToSave,
              customer_email: customerEmail.trim(),
              comment: comment.trim() || null,
              is_restaurant_table: stop.is_restaurant_table,
            });
            if (accessToken && createdCartItem?.id) {
              scheduleN8nWaBookingStart(createdCartItem.id, accessToken);
            }
            results.push({ stop, ok: true });
          } catch (e) {
            if (isAuthRequiredError(e)) {
              setLastBookResults(results);
              navigateToAuthScreen(navigation);
              return;
            }
            if (isInsufficientBookingCreditsError(e)) {
              showInsufficientCreditsToast(stops.length);
              setLastBookResults(results);
              return;
            }
            const message = e instanceof Error ? e.message : String(e);
            results.push({ stop, ok: false, message });
          }
        }
        setLastBookResults(results);
        const failed = results.filter((r) => !r.ok);
        const okc = results.filter((r) => r.ok).length;
        if (failed.length === 0) {
          appAlert(
            t("bookingCommon.draftCreatedTitle"),
            t("bookingCommon.draftCreatedMessage"),
            undefined,
            "success",
          );
        } else if (okc > 0) {
          Alert.alert(
            t("vibeMatch.partialBookingTitle"),
            t("vibeMatch.partialBookingMessage", { okCount: okc, failedCount: failed.length }),
          );
        } else {
          Alert.alert(t("vibeMatch.bookingFailedTitle"), t("vibeMatch.bookingFailedMessage"));
        }
        if (okc > 0) {
          navigation.getParent()?.dispatch(
            CommonActions.navigate({
              name: "Bookings",
              params: { screen: "BookingsMain" },
            }),
          );
        }
      } finally {
        setBookingAction(null);
      }
    },
    [
      comment,
      createBooking,
      createCartItem,
      customerEmail,
      customerName,
      customerPhone,
      navigation,
      persons,
      plan,
      balance,
      exemptFromBookingCredits,
      session?.access_token,
      showInsufficientCreditsToast,
      stopAvailability,
      getGuestFormError,
      bookingAction,
      t,
    ],
  );

  const onBookAll = useCallback(async () => {
    if (selectedBookableStops.length === 0) return;
    await runBookStops(selectedBookableStops, "all");
  }, [runBookStops, selectedBookableStops]);

  const openPlaceDetails = useCallback(
    (venueId: string) => {
      navigation.navigate("PlaceDetail", { id: venueId, hideBookingActions: true });
    },
    [navigation],
  );

  const failedStops = useMemo(
    () => (lastBookResults?.filter((r): r is Extract<BookRowResult, { ok: false }> => !r.ok) ?? []).map((r) => r.stop),
    [lastBookResults],
  );

  const onRetryFailed = useCallback(async () => {
    if (failedStops.length === 0) return;
    await runBookStops(failedStops, "retry");
  }, [failedStops, runBookStops]);

  const errMsg = vibeError instanceof Error ? vibeError.message : vibeError ? String(vibeError) : "";

  if (authLoading || accessLoading) {
    return (
      <View style={[styles.root, { alignItems: "center", justifyContent: "center" }]} {...androidSwipeBackPanHandlers}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (shouldEnforcePaywall && !canAccessVibeMatch && !vibeResult) {
    return null;
  }

  return (
    <View style={styles.root} {...androidSwipeBackPanHandlers}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scroll, { paddingBottom: 120 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        nestedScrollEnabled
        onScroll={(event) => {
          scrollYRef.current = event.nativeEvent.contentOffset.y;
          onKeyboardScroll(event);
        }}
        scrollEventThrottle={16}
      >
        <View style={styles.topRow}>
          <AppPressable style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel={t("bookingCommon.goBack")}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </AppPressable>
          <Text style={styles.title}>{t("vibeMatch.title")}</Text>
        </View>
        <BookingCreditsBadge
          balance={balance}
          isIntroActive={isIntroActive}
          hasPaidPremium={hasPaidPremium}
          introPeriodEndsAt={introPeriodEndsAt}
        />
        <Text style={styles.subtitle}>{t("vibeMatch.subtitle")}</Text>

        <View style={styles.section}>
          <Text style={styles.label}>{t("vibeMatch.cityLabel")}</Text>
          <AppPressable
            onPress={() => {
              setCitySearchQuery("");
              setCityPickerVisible(true);
            }}
            style={[styles.input, { justifyContent: "center" }]}
          >
            <Text style={{ color: city.trim() ? colors.text : colors.textMuted }}>
              {city.trim() || t("bookingCommon.selectCity")}
            </Text>
          </AppPressable>
          <Text style={styles.label}>{t("vibeMatch.moodLabel")}</Text>
          <VibeMoodCards options={VIBE_MATCH_MOOD_OPTIONS} selected={selectedMoods} onToggle={toggleMood} />
          <TextInput
            style={styles.input}
            placeholder={t("vibeMatch.moodNotesPlaceholder")}
            placeholderTextColor={colors.textMuted}
            value={mood}
            onChangeText={setMood}
          />
          <Text style={styles.label}>{t("vibeMatch.timelineLabel")}</Text>
          <VibeTimelineSelector
            value={timeline}
            disabled={timeSelectionMode === "custom"}
            onChange={handleTimelineChange}
          />
          <Text style={[styles.timelineOrLabel, { color: colors.textMuted }]}>{t("vibeMatch.timelineOr")}</Text>
          <Text style={[styles.customWindowLabel, { color: colors.textMuted }]}>
            {t("vibeMatch.customTimeWindowLabel")}
          </Text>
          <VibeCustomTimeWindowSlider
            value={customTimeWindow}
            onChange={handleCustomWindowChange}
            inactive={timeSelectionMode === "preset"}
          />
          <AppPressable
            onPress={() => void onGenerate()}
            disabled={isVibeLoading}
            style={{ marginTop: 12, borderRadius: SHARED_PRESSABLE_RADIUS, overflow: "hidden", opacity: isVibeLoading ? 0.7 : 1 }}
          >
            <LinearGradient
              colors={[...ctaGradientColors(isDark)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ height: SHARED_PRESSABLE_HEIGHT, alignItems: "center", justifyContent: "center" }}
            >
              {isVibeLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={primaryPressableTextStyle}>{t("vibeMatch.generatePlan")}</Text>
              )}
            </LinearGradient>
          </AppPressable>
          {isVibeLoading ? (
            <View style={styles.routeMapSkeletonHost}>
              <VibeRouteMapSkeleton />
              <VibeGenerationPulse active />
            </View>
          ) : null}
          {vibeError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errMsg || t("vibeMatch.couldNotGeneratePlan")}</Text>
              <AppPressable onPress={onRetryGenerate} style={{ marginTop: 8 }}>
                <Text style={{ color: colors.primary, fontWeight: "700" }}>{t("bookingCommon.retry")}</Text>
              </AppPressable>
            </View>
          ) : null}
        </View>

        {vibeResult && !isVibeLoading ? (
          <View
            style={styles.section}
            onLayout={(event) => {
              conciergeScrollYRef.current = event.nativeEvent.layout.y;
              scheduleScrollToConcierge();
            }}
          >
            <Text style={styles.label}>{t("vibeMatch.conciergeLabel")}</Text>
            <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>{conciergeMessage}</Text>
          </View>
        ) : null}

        {vibeResult && plan.length === 0 && !isVibeLoading ? (
          <Text style={styles.emptyText}>{t("vibeMatch.noVenuesMatched")}</Text>
        ) : null}

        {vibeResult && plan.length > 0 && !slotsAvailabilityReady && !isVibeLoading ? (
          <View style={[styles.section, { alignItems: "center", paddingVertical: 24 }]}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.emptyText, { marginTop: 12 }]}>{t("vibeMatch.checkingRouteAvailability")}</Text>
          </View>
        ) : null}

        {suggestedPlan.length > 0 ? (
          <View style={styles.section}>
            {showSelectionWarning ? (
              <View style={styles.selectionWarning}>
                <Text style={styles.selectionWarningText}>{t("vibeMatch.chooseAtLeastOnePlace")}</Text>
              </View>
            ) : null}
            {initialRouteMapReady ? (
              <VibeRouteMap
                points={routeMapPoints}
                polylineCoords={routePolylineCoords}
                travelMode={routeTravelMode}
                onTravelModeChange={setRouteTravelMode}
                isLoading={isRouteUpdating}
                loadingLabel={showRouteRebuildLabel ? t("vibeMatch.routeMapRebuilding") : undefined}
                loadingOverlayLight={showRouteRebuildLabel}
                missingCount={routeMapMissingCount}
                durationText={showRouteRebuildLabel ? null : routeDurationText}
                distanceText={showRouteRebuildLabel ? null : routeDistanceText}
                usesStraightFallback={routeUsesStraightFallback}
              />
            ) : (
              <View style={styles.routeMapSkeletonSlot}>
                <VibeRouteMapSkeleton />
              </View>
            )}
            <Text style={styles.label}>{t("vibeMatch.yourRoute")}</Text>
            <View style={styles.routeTimeline}>
              {suggestedPlan.map((stop, i) => {
                const checked = selectedVenueIdSet.has(stop.venue_id);
                const isLast = i === suggestedPlan.length - 1;
                const { uri: thumbUri, fallbackUri: thumbFallback } = vibeStopThumbUris(stop.images);
                const addressLine = formatStopAddress(stop);
                const activityLabel = resolveStopActivityLabel(stop, i, suggestedPlan.length, t);
                const categoryLabel = resolveStopCategoryLabel(stop, i, suggestedPlan.length, t);
                const rating = stop.rating != null && stop.rating > 0 ? stop.rating : null;
                return (
                  <View key={`${stop.venue_id}-${i}`} style={styles.routeStop}>
                    <View style={styles.routeLeftCol}>
                      {!isSingleStopRoute ? (
                        <AppPressable
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked, disabled: isRouteUpdating }}
                          accessibilityLabel={
                            checked
                              ? t("vibeMatch.deselectVenueA11y", { name: stop.name })
                              : t("vibeMatch.selectVenueA11y", { name: stop.name })
                          }
                          disabled={isRouteUpdating}
                          onPress={() => toggleVenueSelection(stop.venue_id, true)}
                          style={[
                            styles.planCheckbox,
                            checked && styles.planCheckboxChecked,
                            isRouteUpdating && styles.planCheckboxDisabled,
                          ]}
                        >
                          {checked ? <Ionicons name="checkmark" size={13} color={colors.onAccent} /> : null}
                        </AppPressable>
                      ) : null}
                      <View style={styles.routeRailCol}>
                        <View style={styles.routeDot} />
                        {!isLast ? <View style={styles.routeLine} /> : null}
                      </View>
                    </View>
                    <View style={styles.routeStopBody}>
                      <View style={styles.routeStopMain}>
                        <View style={styles.routeStopText}>
                          <View style={styles.routeStopTimeRow}>
                            <Text style={styles.routeStopTime}>
                              {formatVibeSlotTimeLabel(stop.time_slot)}
                            </Text>
                            <Text style={styles.routeStopActivity}>{activityLabel}</Text>
                          </View>
                          <View style={styles.routeStopTitleBlock}>
                            <Text style={styles.routeStopName} numberOfLines={2}>
                              {stop.name}
                            </Text>
                            {addressLine ? (
                              <Text style={styles.routeStopAddress} numberOfLines={2}>
                                {addressLine}
                              </Text>
                            ) : null}
                          </View>
                          <View style={styles.routeStopBadges}>
                            <View style={styles.routeCategoryPill}>
                              <Text style={styles.routeCategoryText}>{categoryLabel}</Text>
                            </View>
                            <AppPressable
                              style={[styles.routeDetailsButton, styles.statusOk]}
                              onPress={() => openPlaceDetails(stop.venue_id)}
                              accessibilityRole="button"
                              accessibilityLabel={t("placeDetail.seeDetails")}
                            >
                              <FontAwesome6 name="share" size={10} color={colors.text} />
                              <Text style={[styles.routeDetailsButtonText, { color: colors.text }]}>
                                {t("placeDetail.seeDetails")}
                              </Text>
                            </AppPressable>
                          </View>
                        </View>
                        <View style={styles.routeThumbWrap}>
                          <SmartImage
                            uri={thumbUri}
                            fallbackUri={thumbFallback}
                            bundledFallback={PLACE_IMAGE_FALLBACK}
                            recyclingKey={`${stop.venue_id}-${i}-thumb`}
                            style={styles.routeThumb}
                            contentFit="cover"
                          />
                          {rating != null ? (
                            <View style={styles.routeRatingBadge}>
                              <Ionicons name="star" size={9} color="#eab308" />
                              <Text style={styles.routeRatingText}>{rating.toFixed(1)}</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
            {showCreditsLimitInfo ? (
              <>
                <View style={[styles.creditsLimitInfo, { marginTop: 12 }]}>
                  <Ionicons name="information-circle-outline" size={22} color={colors.primary} />
                  <Text style={styles.creditsLimitInfoText}>
                    {t("vibeMatch.creditsLimitMessage", { count: balance })}
                  </Text>
                </View>
                <AppPressable
                  style={[
                    primaryPressableStyle,
                    {
                      height: SHARED_PRESSABLE_HEIGHT,
                      borderRadius: SHARED_PRESSABLE_RADIUS,
                      marginTop: 12,
                    },
                  ]}
                  onPress={() => openSubscriptionPaywall("upgrade")}
                  accessibilityLabel={t("vibeMatch.creditsLimitCtaA11y")}
                >
                  <Text style={primaryPressableTextStyle}>{t("vibeMatch.creditsLimitCta")}</Text>
                </AppPressable>
              </>
            ) : null}
            {showPaywallCta ? (
              <>
                <Text style={[styles.emptyText, { marginTop: 12, marginBottom: 0 }]}>
                  {t("bookingCredits.noCreditsMessage")}
                </Text>
                <AppPressable
                  style={[
                    primaryPressableStyle,
                    {
                      height: SHARED_PRESSABLE_HEIGHT,
                      borderRadius: SHARED_PRESSABLE_RADIUS,
                      marginTop: 12,
                    },
                  ]}
                  onPress={() => openSubscriptionPaywall("no_credits")}
                  accessibilityLabel={t("vibeMatch.noCreditsCtaA11y")}
                >
                  <Text style={primaryPressableTextStyle}>{t("vibeMatch.noCreditsCta")}</Text>
                </AppPressable>
              </>
            ) : null}
          </View>
        ) : null}

        {suggestedPlan.length > 0 && !showPaywallCta ? (
          <View style={styles.section}>
            <Text style={styles.label}>{t("vibeMatch.guestDetails")}</Text>
            <TextInput
              ref={personsInputRef}
              style={styles.input}
              placeholder={t("bookingCommon.partySize")}
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              value={persons}
              onChangeText={setPersons}
              onFocus={() => handleGuestInputFocus(personsInputRef)}
            />
            <TextInput
              ref={customerNameInputRef}
              style={styles.input}
              placeholder={t("bookingCommon.fullName")}
              placeholderTextColor={colors.textMuted}
              value={customerName}
              onChangeText={setCustomerName}
              onFocus={() => handleGuestInputFocus(customerNameInputRef)}
            />
            <PhoneInput
              inputRef={phoneInputRef}
              value={customerPhone}
              onChange={setCustomerPhone}
              containerStyle={{ backgroundColor: colors.background }}
              onFocus={() => handleGuestInputFocus(phoneInputRef)}
            />
            <TextInput
              ref={customerEmailInputRef}
              style={styles.input}
              placeholder={t("bookingCommon.email")}
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              value={customerEmail}
              onChangeText={setCustomerEmail}
              onFocus={() => handleGuestInputFocus(customerEmailInputRef)}
            />
            <TextInput
              ref={commentInputRef}
              style={[styles.input, { minHeight: 72 }]}
              placeholder={t("bookingCommon.commentOptional")}
              placeholderTextColor={colors.textMuted}
              multiline
              value={comment}
              onChangeText={setComment}
              onFocus={() => handleGuestInputFocus(commentInputRef)}
            />
            <BookingProfileCompleteTip
              visible={showProfileCompleteTip}
              navigation={navigation}
              style={{ marginTop: 4 }}
            />
            <AppPressable
              disabled={!bookAllEnabled || bookingBusy}
              onPress={() => void onBookAll()}
              accessibilityLabel={
                isSingleStopRoute ? t("vibeMatch.bookStopA11y") : t("vibeMatch.bookAllStopsA11y")
              }
              style={{
                borderRadius: SHARED_PRESSABLE_RADIUS,
                overflow: "hidden",
                opacity: !bookAllEnabled || bookingBusy ? 0.55 : 1,
              }}
            >
              <LinearGradient
                colors={[...ctaGradientColors(isDark)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ height: SHARED_PRESSABLE_HEIGHT, alignItems: "center", justifyContent: "center" }}
              >
                {bookingAction === "all" ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={primaryPressableTextStyle}>
                    {isSingleStopRoute ? t("vibeMatch.book") : t("vibeMatch.bookAll")}
                  </Text>
                )}
              </LinearGradient>
            </AppPressable>
            {failedStops.length > 0 ? (
              <AppPressable
                onPress={() => void onRetryFailed()}
                disabled={bookingBusy}
                style={{ alignItems: "center", paddingVertical: 8, flexDirection: "row", justifyContent: "center", gap: 8 }}
              >
                {bookingAction === "retry" ? <ActivityIndicator color={colors.primary} /> : null}
                <Text style={{ color: colors.primary, fontWeight: "700" }}>
                  {t("vibeMatch.retryFailed", { count: failedStops.length })}
                </Text>
              </AppPressable>
            ) : null}
            {lastBookResults ? (
              <View style={{ gap: 6 }}>
                {lastBookResults.map((r, idx) => (
                  <Text key={idx} style={{ color: r.ok ? colors.textMuted : "#c45c26", fontSize: 12 }}>
                    {r.stop.name}: {r.ok ? t("vibeMatch.addedToBookings") : r.message}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <AppPressable onPress={onClearPlan} style={{ alignItems: "center" }}>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t("vibeMatch.clearPlan")}</Text>
        </AppPressable>
      </ScrollView>

      <BottomSheetPickerModal
        visible={cityPickerVisible}
        onClose={() => {
          setCitySearchQuery("");
          setCityPickerVisible(false);
        }}
        title={t("vibeMatch.cityLabel")}
        maxHeightFraction={0.72}
      >
        <View style={styles.citySearchBox}>
          <Ionicons name="search-outline" size={20} color={colors.textMuted} />
          <TextInput
            value={citySearchQuery}
            onChangeText={setCitySearchQuery}
            placeholder={t("bookingCommon.searchCityOrCountry")}
            placeholderTextColor={colors.textMuted}
            style={styles.citySearchInput}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>

        {filteredCityGroups.map(({ country, cities }) => (
          <View key={country}>
            <View style={styles.countryHeader}>
              <Text style={styles.countryHeaderText}>{country}</Text>
            </View>
            {cities.map((c) => (
              <AppPressable
                key={c}
                style={styles.pickerRow}
                onPress={() => {
                  setCity(c);
                  setCitySearchQuery("");
                  setCityPickerVisible(false);
                }}
              >
                <Text style={styles.pickerRowText}>{c}</Text>
                {city.trim() === c ? <Text style={styles.pickerCheck}>{t("bookingCommon.selected")}</Text> : null}
              </AppPressable>
            ))}
          </View>
        ))}

        {filteredCityGroups.length === 0 ? (
          <View style={styles.cityPickerEmpty}>
            <Text style={styles.cityPickerEmptyText}>{t("bookingCommon.noCitiesMatch")}</Text>
          </View>
        ) : null}
      </BottomSheetPickerModal>
    </View>
  );
}

export default function VibeMatchPage() {
  return (
    <PageI18nProvider>
      <VibeMatchPageContent />
    </PageI18nProvider>
  );
}
