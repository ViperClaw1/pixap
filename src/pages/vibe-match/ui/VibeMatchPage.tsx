import { AppPressable } from "@/shared/ui/app-pressable";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  PixelRatio
} from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useKeyboardInset } from "@/shared/lib/keyboard";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CommonActions, useNavigation, type NavigationProp, type ParamListBase } from "@react-navigation/native";
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
  isTimeSlotInTimelineWindow,
  normalizeVibePlanStops,
  snapIsoToThirtyMinuteGrid,
} from "@/entities/pixai/lib/vibeBookingWindow";
import { fetchAvailableSlotsForDay, useCreateBooking } from "@/entities/booking";
import { BOOKING_SLOT_STEP_MINUTES } from "@/entities/booking/lib/bookingSlots";
import { useCreateCartItem } from "@/entities/cart";
import { normalizeWaInterfaceLocale, startN8nWaBooking } from "@/entities/cart";
import { i18n, PageI18nProvider } from "@/shared/lib/i18n";
import { isAuthRequiredError, navigateToAuthScreen } from "@/shared/lib/auth/authRequired";
import { isProfileComplete } from "@/shared/lib/profileCompletion";
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
import { VIBE_OPTIONS, type TaxonomyOption } from "@/entities/user-preferences";
import { OnboardingChipGrid } from "@/shared/ui/onboarding/OnboardingChipGrid";
import { devWarn } from "@/shared/lib/devLog";
import Toast from "react-native-toast-message";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VIBE_MATCH_MOOD_OPTIONS: TaxonomyOption[] = VIBE_OPTIONS.map((option) => ({
  ...option,
  labelPrefix: "vibeMatch.vibes",
}));

const SLOT_MATCH_MS = BOOKING_SLOT_STEP_MINUTES * 60_000;
const PLAN_THUMB_SIZE = 80;
const MAX_SUGGESTED_VENUES = 4;
const VIBE_TIMELINE_OPTIONS: PixAIVibeTimeline[] = ["day", "evening", "night", "late_night"];

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
  if (index === total - 1 && total > 1) return t("vibeMatch.stopActivity.lateNight");
  if (hour >= 22) return t("vibeMatch.stopActivity.lateNight");
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
  timeline: PixAIVibeTimeline,
): string | null {
  const t = new Date(snapIsoToThirtyMinuteGrid(proposedIso, timeline)).getTime();
  let best: PixAISlot | null = null;
  let bestDist = Infinity;
  for (const s of slots) {
    if (!s.available) continue;
    if (!isTimeSlotInTimelineWindow(s.dateTimeIso, timeline)) continue;
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
  const keyboardInset = useKeyboardInset({ bottomInset: insets.bottom });
  const keyboardRootStyle = useAnimatedStyle(
    () => ({ paddingBottom: keyboardInset.value }),
    [keyboardInset],
  );
  const { colors } = useAppTheme();
  const navigation = useNavigation<Nav>();
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
    timeline: PixAIVibeTimeline;
    city: string;
  } | null>(null);
  const selectionSeededForPlanRef = useRef("");
  const bookingBusy = bookingAction !== null;

  const plan = useMemo(
    () => normalizeVibePlanStops(vibeResult?.plan ?? [], timeline),
    [timeline, vibeResult?.plan],
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
        queryKey: queryKeys.availableSlots(stop.venue_id, ymd),
        queryFn: () => fetchAvailableSlotsForDay(stop.venue_id, ymd),
        enabled: plan.length > 0,
      };
    }),
  });

  const stopAvailability = useMemo(() => {
    return plan.map((stop, i) => {
      const q = slotQueries[i];
      const slots = q?.data ?? [];
      const dateTime = resolveBookingDateTime(slots, stop.time_slot, timeline);
      return {
        loading: Boolean(q?.isPending),
        error: Boolean(q?.isError),
        bookable: dateTime != null && isTimeSlotBookableNow(dateTime),
        dateTime,
        slots,
      };
    });
  }, [plan, slotQueries, timeline]);

  const slotsAvailabilityReady =
    plan.length > 0 && !stopAvailability.some((x) => x.loading);

  const bookableRouteStops = useMemo(
    () =>
      slotsAvailabilityReady ? filterBookableVibePlanStops(plan, stopAvailability, timeline) : [],
    [plan, stopAvailability, slotsAvailabilityReady, timeline],
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

  const showSelectionWarning =
    !isSingleStopRoute &&
    slotsAvailabilityReady &&
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
    setLastVibeContext({ mood: resolveMoodDisplay(), timeline, city: cityTrim });
    try {
      await runVibePlan({ mood: moodSlugs, timeline, city: cityTrim, limit: MAX_SUGGESTED_VENUES });
    } catch {
      /* surfaced via vibeError */
    }
  }, [city, resolveMoodDisplay, resolveMoodSlugs, runVibePlan, t, timeline]);

  const onClearPlan = useCallback(() => {
    resetVibePlan();
    setLastVibeContext(null);
  }, [resetVibePlan]);

  const onRetryGenerate = useCallback(() => {
    void onGenerate();
  }, [onGenerate]);

  const validateForm = useCallback(() => {
    const p = Number(persons);
    if (!Number.isFinite(p) || p < 1) return t("bookingCommon.invalidPartySize");
    if (!customerName.trim()) return t("bookingCommon.nameRequired");
    if (validatePhoneValue(customerPhone) !== null) return t("bookingCommon.invalidPhone");
    if (!EMAIL_REGEX.test(customerEmail.trim())) return t("bookingCommon.invalidEmail");
    return null;
  }, [customerEmail, customerName, customerPhone, persons, t]);

  const runBookStops = useCallback(
    async (stops: VibePlanStop[], action: VibeBookingAction) => {
      if (bookingAction !== null) return;
      const err = validateForm();
      if (err) {
        Alert.alert(t("vibeMatch.formAlertTitle"), err);
        return;
      }
      if (!isProfileComplete(profile)) {
        Alert.alert(t("bookingCommon.profileIncompleteTitle"), t("bookingCommon.profileIncompleteMessage"));
        navigation.getParent()?.dispatch(
          CommonActions.navigate({
            name: "Profile",
            params: { screen: "EditProfile" },
          }),
        );
        return;
      }
      if (!exemptFromBookingCredits && balance < stops.length) {
        showInsufficientCreditsToast(stops.length);
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
      profile,
      balance,
      exemptFromBookingCredits,
      session?.access_token,
      showInsufficientCreditsToast,
      stopAvailability,
      validateForm,
      bookingAction,
      t,
    ],
  );

  const onBookAll = useCallback(async () => {
    if (selectedBookableStops.length === 0) return;
    await runBookStops(selectedBookableStops, "all");
  }, [runBookStops, selectedBookableStops]);

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
    <Animated.View style={[styles.root, keyboardRootStyle]} {...androidSwipeBackPanHandlers}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
        <View style={styles.topRow}>
          <AppPressable style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel={t("bookingCommon.goBack")}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </AppPressable>
          <Text style={styles.title}>{t("vibeMatch.title")}</Text>
        </View>
        <BookingCreditsBadge
          balance={balance}
          isIntroActive={isIntroActive}
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
          <OnboardingChipGrid options={VIBE_MATCH_MOOD_OPTIONS} selected={selectedMoods} onToggle={toggleMood} />
          <TextInput
            style={styles.input}
            placeholder={t("vibeMatch.moodNotesPlaceholder")}
            placeholderTextColor={colors.textMuted}
            value={mood}
            onChangeText={setMood}
          />
          <Text style={styles.label}>{t("vibeMatch.timelineLabel")}</Text>
          <View style={styles.timelineRow}>
            {VIBE_TIMELINE_OPTIONS.map((timelineKey) => (
              <AppPressable
                key={timelineKey}
                onPress={() => setTimeline(timelineKey)}
                style={[styles.chip, timeline === timelineKey && styles.chipOn]}
              >
                <Text style={styles.chipText}>
                  {t(`vibeMatch.timeline.${timelineKey === "late_night" ? "lateNight" : timelineKey}`)}
                </Text>
              </AppPressable>
            ))}
          </View>
          <AppPressable
            style={[primaryPressableStyle, { height: SHARED_PRESSABLE_HEIGHT, borderRadius: SHARED_PRESSABLE_RADIUS }]}
            onPress={() => void onGenerate()}
            disabled={isVibeLoading}
          >
            {isVibeLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={primaryPressableTextStyle}>{t("vibeMatch.generatePlan")}</Text>
            )}
          </AppPressable>
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
          <View style={styles.section}>
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
              <VibeRouteMapSkeleton />
            )}
            <Text style={styles.label}>{t("vibeMatch.yourRoute")}</Text>
            <View style={styles.routeTimeline}>
              {suggestedPlan.map((stop, i) => {
                const checked = selectedVenueIdSet.has(stop.venue_id);
                const routeStopMeta = bookableRouteStopByVenueId.get(stop.venue_id);
                const slotBookable = routeStopMeta?.meta.bookable === true;
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
                            <View style={[styles.statusPill, slotBookable ? styles.statusOk : styles.statusPending]}>
                              <Text style={[styles.statusText, { color: colors.text }]}>
                                {slotBookable
                                  ? t("vibeMatch.slotAvailable")
                                  : t("vibeMatch.slotSuggested")}
                              </Text>
                            </View>
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
              style={styles.input}
              placeholder={t("bookingCommon.partySize")}
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              value={persons}
              onChangeText={setPersons}
            />
            <TextInput
              style={styles.input}
              placeholder={t("bookingCommon.fullName")}
              placeholderTextColor={colors.textMuted}
              value={customerName}
              onChangeText={setCustomerName}
            />
            <PhoneInput
              value={customerPhone}
              onChange={setCustomerPhone}
              containerStyle={{ backgroundColor: colors.background }}
            />
            <TextInput
              style={styles.input}
              placeholder={t("bookingCommon.email")}
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              value={customerEmail}
              onChangeText={setCustomerEmail}
            />
            <TextInput
              style={[styles.input, { minHeight: 72 }]}
              placeholder={t("bookingCommon.commentOptional")}
              placeholderTextColor={colors.textMuted}
              multiline
              value={comment}
              onChangeText={setComment}
            />
            <AppPressable
              style={[
                primaryPressableStyle,
                { height: SHARED_PRESSABLE_HEIGHT, borderRadius: SHARED_PRESSABLE_RADIUS },
                (!bookAllEnabled || bookingBusy) && { opacity: 0.55 },
              ]}
              disabled={!bookAllEnabled || bookingBusy}
              onPress={() => void onBookAll()}
              accessibilityLabel={
                isSingleStopRoute ? t("vibeMatch.bookStopA11y") : t("vibeMatch.bookAllStopsA11y")
              }
            >
              {bookingAction === "all" ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={primaryPressableTextStyle}>
                  {isSingleStopRoute ? t("vibeMatch.book") : t("vibeMatch.bookAll")}
                </Text>
              )}
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
    </Animated.View>
  );
}

export default function VibeMatchPage() {
  return (
    <PageI18nProvider>
      <VibeMatchPageContent />
    </PageI18nProvider>
  );
}
