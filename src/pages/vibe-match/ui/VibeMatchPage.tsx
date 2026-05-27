import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  PixelRatio,
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
  normalizeVibePlanStops,
  snapIsoToThirtyMinuteGrid,
} from "@/entities/pixai/lib/vibeBookingWindow";
import { fetchAvailableSlotsForDay, useCreateBooking } from "@/entities/booking";
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

const SLOT_MATCH_MS = 15 * 60 * 1000;
const PLAN_THUMB_SIZE = 56;

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

/** Closest available slot to proposed time within SLOT_MATCH_MS; otherwise null. */
function resolveBookingDateTime(slots: PixAISlot[], proposedIso: string): string | null {
  const t = new Date(snapIsoToThirtyMinuteGrid(proposedIso)).getTime();
  let best: PixAISlot | null = null;
  let bestDist = Infinity;
  for (const s of slots) {
    if (!s.available) continue;
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
  const keyboardInset = useKeyboardInset({ bottomInset: insets.bottom, gap: 16 });
  const keyboardRootStyle = useAnimatedStyle(() => ({
    paddingBottom: keyboardInset.value,
  }));
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
  useSubscriptionPaywallRedirect({
    accessLoading,
    shouldEnforcePaywall,
    hasAccess: canAccessVibeMatch,
    paywallReason: !canUseBookingCredits ? "no_credits" : "upgrade",
    navigation: navigation as {
      replace: (name: "SubscriptionPaywall", params?: { reason?: "no_credits" | "upgrade" }) => void;
    },
  });

  const { data: profile } = useProfile();
  const { data: availableCities = [ALL_CITIES_OPTION] } = useAvailableCities();
  const { runVibePlan, isVibeLoading, vibeResult, vibeError, resetVibePlan } = usePixAI();
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
    () => normalizeVibePlanStops(vibeResult?.plan ?? []),
    [vibeResult?.plan],
  );
  const isSingleStopRoute = plan.length === 1;
  const planSelectionKey = useMemo(
    () => plan.map((s) => `${s.venue_id}:${s.time_slot}`).join("|"),
    [plan],
  );

  const conciergeMessage = useMemo(() => {
    if (!lastVibeContext || !vibeResult) return "";
    return buildVibeRouteAssistantMessage(
      {
        ...lastVibeContext,
        stopCount: plan.length,
      },
      t,
    );
  }, [lastVibeContext, vibeResult, plan.length, t, i18n.language]);

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
      const dateTime = resolveBookingDateTime(slots, stop.time_slot);
      return {
        loading: Boolean(q?.isPending),
        error: Boolean(q?.isError),
        bookable: dateTime != null,
        dateTime,
        slots,
      };
    });
  }, [plan, slotQueries]);

  const slotsAvailabilityReady =
    plan.length > 0 && !stopAvailability.some((x) => x.loading || x.error);
  const allBookable =
    plan.length > 0 && stopAvailability.every((x) => x.bookable) && slotsAvailabilityReady;

  const bookableVenueIds = useMemo(
    () => plan.filter((_, i) => stopAvailability[i]?.bookable).map((s) => s.venue_id),
    [plan, stopAvailability],
  );

  useEffect(() => {
    if (planSelectionKey === selectionSeededForPlanRef.current) return;
    selectionSeededForPlanRef.current = "";
    setSelectedVenueIds([]);
  }, [planSelectionKey]);

  useEffect(() => {
    if (exemptFromBookingCredits) return;
    setSelectedVenueIds((prev) =>
      prev.length <= bookingSelectionLimit ? prev : prev.slice(0, bookingSelectionLimit),
    );
  }, [bookingSelectionLimit, exemptFromBookingCredits]);

  useEffect(() => {
    if (!slotsAvailabilityReady || bookableVenueIds.length === 0) return;
    if (selectionSeededForPlanRef.current === planSelectionKey) return;
    selectionSeededForPlanRef.current = planSelectionKey;
    setSelectedVenueIds(bookableVenueIds.slice(0, Math.max(0, bookingSelectionLimit)));
  }, [bookableVenueIds, bookingSelectionLimit, planSelectionKey, slotsAvailabilityReady]);

  const selectedVenueIdSet = useMemo(() => new Set(selectedVenueIds), [selectedVenueIds]);

  const selectedBookableStops = useMemo(
    () => plan.filter((stop, i) => selectedVenueIdSet.has(stop.venue_id) && stopAvailability[i]?.bookable),
    [plan, selectedVenueIdSet, stopAvailability],
  );

  const hasVenueSelection = isSingleStopRoute || selectedBookableStops.length > 0;
  const canBookFullRoute = isSingleStopRoute || plan.length <= bookingSelectionLimit;
  const bookAllEnabled = allBookable && hasVenueSelection && canBookFullRoute;
  const partialBookEnabled =
    !isSingleStopRoute && slotsAvailabilityReady && selectedBookableStops.length >= 1;
  const showSelectionWarning =
    !isSingleStopRoute &&
    slotsAvailabilityReady &&
    bookableVenueIds.length > 1 &&
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
      await runVibePlan({ mood: moodSlugs, timeline, city: cityTrim, limit: 5 });
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
    if (!bookAllEnabled) {
      if (!canBookFullRoute) {
        showInsufficientCreditsToast(plan.length);
        return;
      }
      if (!allBookable) {
        Alert.alert(t("vibeMatch.availabilityTitle"), t("vibeMatch.availabilityMessage"));
      }
      return;
    }
    await runBookStops(plan, "all");
  }, [allBookable, bookAllEnabled, canBookFullRoute, plan, runBookStops, showInsufficientCreditsToast, t]);

  const onPartialBook = useCallback(async () => {
    if (!partialBookEnabled || selectedBookableStops.length === 0) return;
    await runBookStops(selectedBookableStops, "partial");
  }, [partialBookEnabled, runBookStops, selectedBookableStops]);

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
  if (shouldEnforcePaywall && !canAccessVibeMatch) {
    return null;
  }

  return (
    <Animated.View style={[styles.root, keyboardRootStyle]} {...androidSwipeBackPanHandlers}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel={t("bookingCommon.goBack")}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
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
          <Pressable
            onPress={() => {
              setCitySearchQuery("");
              setCityPickerVisible(true);
            }}
            style={[styles.input, { justifyContent: "center" }]}
          >
            <Text style={{ color: city.trim() ? colors.text : colors.textMuted }}>
              {city.trim() || t("bookingCommon.selectCity")}
            </Text>
          </Pressable>
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
            {(["evening", "night", "late_night"] as const).map((timelineKey) => (
              <Pressable
                key={timelineKey}
                onPress={() => setTimeline(timelineKey)}
                style={[styles.chip, timeline === timelineKey && styles.chipOn]}
              >
                <Text style={styles.chipText}>
                  {t(`vibeMatch.timeline.${timelineKey === "late_night" ? "lateNight" : timelineKey}`)}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            style={[primaryPressableStyle, { height: SHARED_PRESSABLE_HEIGHT, borderRadius: SHARED_PRESSABLE_RADIUS }]}
            onPress={() => void onGenerate()}
            disabled={isVibeLoading}
          >
            {isVibeLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={primaryPressableTextStyle}>{t("vibeMatch.generatePlan")}</Text>
            )}
          </Pressable>
          {vibeError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errMsg || t("vibeMatch.couldNotGeneratePlan")}</Text>
              <Pressable onPress={onRetryGenerate} style={{ marginTop: 8 }}>
                <Text style={{ color: colors.primary, fontWeight: "700" }}>{t("bookingCommon.retry")}</Text>
              </Pressable>
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

        {plan.length > 0 ? (
          <View style={styles.section}>
            {showSelectionWarning ? (
              <View style={styles.selectionWarning}>
                <Text style={styles.selectionWarningText}>{t("vibeMatch.chooseAtLeastOnePlace")}</Text>
              </View>
            ) : null}
            <Text style={styles.label}>{t("vibeMatch.yourRoute")}</Text>
            {plan.map((stop, i) => {
              const meta = stopAvailability[i];
              const warn = meta && !meta.loading && !meta.error && !meta.bookable;
              const bookable = Boolean(meta?.bookable);
              const checked = selectedVenueIdSet.has(stop.venue_id);
              const { uri: thumbUri, fallbackUri: thumbFallback } = vibeStopThumbUris(stop.images);
              return (
                <View key={`${stop.venue_id}-${i}`} style={[styles.planRow, warn && styles.planRowWarn]}>
                  <View style={styles.planRowMain}>
                    <SmartImage
                      uri={thumbUri}
                      fallbackUri={thumbFallback}
                      bundledFallback={PLACE_IMAGE_FALLBACK}
                      recyclingKey={`${stop.venue_id}-${i}-thumb`}
                      style={styles.planThumb}
                      contentFit="cover"
                    />
                    <View style={styles.planRowBody}>
                      <View style={styles.planRowHeader}>
                        <View style={styles.planRowHeaderMain}>
                          <Text style={styles.planTime}>
                            {new Date(stop.time_slot).toLocaleString(i18n.language, {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </Text>
                          <Text style={styles.planName}>{stop.name}</Text>
                        </View>
                        {!isSingleStopRoute ? (
                          <Pressable
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked, disabled: !bookable }}
                            accessibilityLabel={
                              checked
                                ? t("vibeMatch.deselectVenueA11y", { name: stop.name })
                                : t("vibeMatch.selectVenueA11y", { name: stop.name })
                            }
                            disabled={!bookable}
                            onPress={() => toggleVenueSelection(stop.venue_id, bookable)}
                            style={[
                              styles.planCheckbox,
                              checked && styles.planCheckboxChecked,
                              !bookable && styles.planCheckboxDisabled,
                            ]}
                          >
                            {checked ? <Ionicons name="checkmark" size={16} color={colors.onAccent} /> : null}
                          </Pressable>
                        ) : null}
                      </View>
                      {stop.description ? <Text style={styles.planDesc}>{stop.description}</Text> : null}
                      <View style={[styles.statusPill, meta?.bookable ? styles.statusOk : styles.statusBad]}>
                        <Text style={[styles.statusText, { color: colors.text }]}>
                          {meta?.loading
                            ? t("vibeMatch.checkingSlots")
                            : meta?.error
                              ? t("vibeMatch.slotCheckFailed")
                              : meta?.bookable
                                ? t("vibeMatch.slotAvailable")
                                : t("vibeMatch.noNearbyFreeSlot")}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {plan.length > 0 ? (
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
            <Pressable
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
            </Pressable>
            {!isSingleStopRoute ? (
              <Pressable
                style={[
                  primaryPressableStyle,
                  { height: SHARED_PRESSABLE_HEIGHT, borderRadius: SHARED_PRESSABLE_RADIUS },
                  (!partialBookEnabled || bookingBusy) && { opacity: 0.55 },
                ]}
                disabled={!partialBookEnabled || bookingBusy}
                onPress={() => void onPartialBook()}
                accessibilityLabel={t("vibeMatch.bookSelectedStopsA11y")}
              >
                {bookingAction === "partial" ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={primaryPressableTextStyle}>
                    {partialBookEnabled
                      ? t("vibeMatch.partialBookCount", { count: selectedBookableStops.length })
                      : t("vibeMatch.partialBook")}
                  </Text>
                )}
              </Pressable>
            ) : null}
            {failedStops.length > 0 ? (
              <Pressable
                onPress={() => void onRetryFailed()}
                disabled={bookingBusy}
                style={{ alignItems: "center", paddingVertical: 8, flexDirection: "row", justifyContent: "center", gap: 8 }}
              >
                {bookingAction === "retry" ? <ActivityIndicator color={colors.primary} /> : null}
                <Text style={{ color: colors.primary, fontWeight: "700" }}>
                  {t("vibeMatch.retryFailed", { count: failedStops.length })}
                </Text>
              </Pressable>
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

        <Pressable onPress={onClearPlan} style={{ alignItems: "center" }}>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t("vibeMatch.clearPlan")}</Text>
        </Pressable>
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
              <Pressable
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
              </Pressable>
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
