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
import { useEntitlement } from "@/entities/subscription";
import { appAlert } from "@/shared/ui/app-popup";
import { useProfile } from "@/entities/user";
import { usePixAI, type PixAIVibeTimeline, type VibePlanStop, type PixAISlot } from "@/entities/pixai";
import { fetchAvailableSlotsForDay, useCreateBooking } from "@/entities/booking";
import { useCreateCartItem } from "@/entities/cart";
import { normalizeWaInterfaceLocale, startN8nWaBooking } from "@/entities/cart";
import { i18n } from "@/shared/lib/i18n";
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
import { getLatestBusinessCardImage } from "@/shared/lib/business-card/businessCardImages";
import { getOptimizedImageUrl } from "@/shared/lib/imageUtils";
import { toYmd } from "@/shared/lib/bookingCalendar";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { useAndroidFullSwipeBackPanHandlers } from "@/shared/lib/useAndroidFullSwipeBackPanHandlers";
import { devWarn } from "@/shared/lib/devLog";

const MOOD_PRESETS = ["romantic evening", "drunk friday", "family brunch", "solo chill", "celebration night"] as const;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SLOT_MATCH_MS = 45 * 60 * 1000;
const PLAN_THUMB_SIZE = 56;

function vibeStopThumbUris(images: string[] | undefined): { uri: string | null; fallbackUri: string | null } {
  const fallbackUri = getLatestBusinessCardImage(images ?? []);
  if (!fallbackUri) return { uri: null, fallbackUri: null };
  const edge = Math.round(PLAN_THUMB_SIZE * Math.min(2, PixelRatio.get()));
  const uri = getOptimizedImageUrl(fallbackUri, edge, edge, 72) || fallbackUri;
  return { uri, fallbackUri };
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
  const t = new Date(proposedIso).getTime();
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

export default function VibeMatchPage() {
  const { t } = useTranslation();
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
  const { hasSubscriptionAccess, isLoading: entitlementLoading } = useEntitlement();
  const shouldEnforcePaywall = shouldEnforceSubscriptionPaywall();

  useAuthSessionRedirect({
    authLoading,
    hasUser: Boolean(user),
    navigation,
  });
  useSubscriptionPaywallRedirect({
    entitlementLoading,
    shouldEnforcePaywall,
    hasSubscriptionAccess,
    navigation: navigation as { replace: (name: "SubscriptionPaywall") => void },
  });

  const { data: profile } = useProfile();
  const { data: availableCities = [ALL_CITIES_OPTION] } = useAvailableCities();
  const { runVibePlan, isVibeLoading, vibeResult, vibeError, resetVibePlan } = usePixAI();
  const createBooking = useCreateBooking();
  const createCartItem = useCreateCartItem();

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
  const selectionSeededForPlanRef = useRef("");
  const bookingBusy = bookingAction !== null;

  const plan = vibeResult?.plan ?? [];
  const isSingleStopRoute = plan.length === 1;
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
    if (!slotsAvailabilityReady || bookableVenueIds.length === 0) return;
    if (selectionSeededForPlanRef.current === planSelectionKey) return;
    selectionSeededForPlanRef.current = planSelectionKey;
    setSelectedVenueIds(bookableVenueIds);
  }, [bookableVenueIds, planSelectionKey, slotsAvailabilityReady]);

  const selectedVenueIdSet = useMemo(() => new Set(selectedVenueIds), [selectedVenueIds]);

  const selectedBookableStops = useMemo(
    () => plan.filter((stop, i) => selectedVenueIdSet.has(stop.venue_id) && stopAvailability[i]?.bookable),
    [plan, selectedVenueIdSet, stopAvailability],
  );

  const hasVenueSelection = isSingleStopRoute || selectedBookableStops.length > 0;
  const bookAllEnabled = allBookable && hasVenueSelection;
  const partialBookEnabled =
    !isSingleStopRoute && slotsAvailabilityReady && selectedBookableStops.length >= 1;
  const showSelectionWarning =
    !isSingleStopRoute &&
    slotsAvailabilityReady &&
    bookableVenueIds.length > 1 &&
    selectedBookableStops.length === 0;

  const toggleVenueSelection = useCallback((venueId: string, bookable: boolean) => {
    if (!bookable) return;
    setSelectedVenueIds((prev) =>
      prev.includes(venueId) ? prev.filter((id) => id !== venueId) : [...prev, venueId],
    );
  }, []);

  const themed = useThemeStyles(
    ({ colors: c }) => vibeMatchThemeStyles(c, insets.top, insets.bottom),
    [insets.top, insets.bottom],
  );
  const styles = useMemo(() => mergeStaticAndThemed(vibeMatchStaticStyles, themed), [themed]);

  const onGenerate = useCallback(async () => {
    const m = mood.trim();
    if (!m) {
      Alert.alert("Mood", "Enter a mood or pick a preset.");
      return;
    }
    const cityTrim = city.trim();
    if (!cityTrim) {
      Alert.alert("City", "Choose a city for your route.");
      return;
    }
    setLastBookResults(null);
    setSelectedVenueIds([]);
    try {
      await runVibePlan({ mood: m, timeline, city: cityTrim, limit: 5 });
    } catch {
      /* surfaced via vibeError */
    }
  }, [city, mood, runVibePlan, timeline]);

  const onRetryGenerate = useCallback(() => {
    void onGenerate();
  }, [onGenerate]);

  const validateForm = useCallback(() => {
    const p = Number(persons);
    if (!Number.isFinite(p) || p < 1) return "Invalid party size.";
    if (!customerName.trim()) return "Name is required.";
    if (validatePhoneValue(customerPhone) !== null) return "Please enter a valid phone number.";
    if (!EMAIL_REGEX.test(customerEmail.trim())) return "Invalid email.";
    return null;
  }, [customerEmail, customerName, customerPhone, persons]);

  const runBookStops = useCallback(
    async (stops: VibePlanStop[], action: VibeBookingAction) => {
      const err = validateForm();
      if (err) {
        Alert.alert("Form", err);
        return;
      }
      if (!isProfileComplete(profile)) {
        Alert.alert("Profile incomplete", "Please, fill out all your profile data before booking.");
        navigation.getParent()?.dispatch(
          CommonActions.navigate({
            name: "Profile",
            params: { screen: "EditProfile" },
          }),
        );
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
            results.push({ stop, ok: false, message: "No available slot near suggested time." });
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
              payment_status: price > 0 ? "pending" : "paid",
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
            const message = e instanceof Error ? e.message : String(e);
            results.push({ stop, ok: false, message });
          }
        }
        setLastBookResults(results);
        const failed = results.filter((r) => !r.ok);
        const okc = results.filter((r) => r.ok).length;
        if (failed.length === 0) {
          const anyPaid = stops.some((s) => Number(s.booking_price ?? 0) > 0);
          if (anyPaid) {
            appAlert(
              "Draft created",
              "Draft booking was added to Bookings. Venue check is started in background.",
              undefined,
              "success",
            );
          } else {
            appAlert("Booking confirmed", `${okc} booking(s) are now in Bookings.`, undefined, "success");
          }
        } else if (okc > 0) {
          Alert.alert(
            "Partial booking",
            `${okc} added to Bookings, ${failed.length} failed. You can retry failed stops below.`,
          );
        } else {
          Alert.alert("Booking failed", "No reservations were created. Check messages below and try again.");
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
      session?.access_token,
      stopAvailability,
      validateForm,
    ],
  );

  const onBookAll = useCallback(async () => {
    if (!bookAllEnabled) {
      if (!allBookable) {
        Alert.alert(
          "Availability",
          "Every stop needs a free slot near the suggested time. Wait for slots to load or adjust the plan.",
        );
      }
      return;
    }
    await runBookStops(plan, "all");
  }, [allBookable, bookAllEnabled, plan, runBookStops]);

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

  if (authLoading || entitlementLoading) {
    return (
      <View style={[styles.root, { alignItems: "center", justifyContent: "center" }]} {...androidSwipeBackPanHandlers}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (shouldEnforcePaywall && !hasSubscriptionAccess) {
    return null;
  }

  return (
    <Animated.View style={[styles.root, keyboardRootStyle]} {...androidSwipeBackPanHandlers}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>PixAI Vibe Match</Text>
        </View>
        <Text style={styles.subtitle}>Mood + evening flow → one-tap multi-stop cart.</Text>

        <View style={styles.section}>
          <Text style={styles.label}>City</Text>
          <Pressable
            onPress={() => {
              setCitySearchQuery("");
              setCityPickerVisible(true);
            }}
            style={[styles.input, { justifyContent: "center" }]}
          >
            <Text style={{ color: city.trim() ? colors.text : colors.textMuted }}>
              {city.trim() || "Select city"}
            </Text>
          </Pressable>
          <Text style={styles.label}>Mood</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. romantic evening"
            placeholderTextColor={colors.textMuted}
            value={mood}
            onChangeText={setMood}
          />
          <View style={styles.chipRow}>
            {MOOD_PRESETS.map((p) => (
              <Pressable key={p} style={styles.chip} onPress={() => setMood(p)}>
                <Text style={styles.chipText}>{p}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Timeline</Text>
          <View style={styles.timelineRow}>
            {(["evening", "night", "late_night"] as const).map((t) => (
              <Pressable
                key={t}
                onPress={() => setTimeline(t)}
                style={[styles.chip, timeline === t && styles.chipOn]}
              >
                <Text style={styles.chipText}>{t.replace("_", " ")}</Text>
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
              <Text style={primaryPressableTextStyle}>Generate plan</Text>
            )}
          </Pressable>
          {vibeError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errMsg || "Could not generate plan."}</Text>
              <Pressable onPress={onRetryGenerate} style={{ marginTop: 8 }}>
                <Text style={{ color: colors.primary, fontWeight: "700" }}>Retry</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {vibeResult && !isVibeLoading ? (
          <View style={styles.section}>
            <Text style={styles.label}>Concierge</Text>
            <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>{vibeResult.assistant}</Text>
          </View>
        ) : null}

        {vibeResult && plan.length === 0 && !isVibeLoading ? (
          <Text style={styles.emptyText}>No venues matched. Try another mood or city.</Text>
        ) : null}

        {plan.length > 0 ? (
          <View style={styles.section}>
            {showSelectionWarning ? (
              <View style={styles.selectionWarning}>
                <Text style={styles.selectionWarningText}>{t("vibeMatch.chooseAtLeastOnePlace")}</Text>
              </View>
            ) : null}
            <Text style={styles.label}>Your route</Text>
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
                            {new Date(stop.time_slot).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                          </Text>
                          <Text style={styles.planName}>{stop.name}</Text>
                        </View>
                        {!isSingleStopRoute ? (
                          <Pressable
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked, disabled: !bookable }}
                            accessibilityLabel={
                              checked ? `Deselect ${stop.name} for booking` : `Select ${stop.name} for booking`
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
                            ? "Checking slots…"
                            : meta?.error
                              ? "Slot check failed"
                              : meta?.bookable
                                ? "Slot available"
                                : "No nearby free slot"}
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
            <Text style={styles.label}>Guest details (cart)</Text>
            <TextInput
              style={styles.input}
              placeholder="Party size"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              value={persons}
              onChangeText={setPersons}
            />
            <TextInput
              style={styles.input}
              placeholder="Full name"
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
              placeholder="Email"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              value={customerEmail}
              onChangeText={setCustomerEmail}
            />
            <TextInput
              style={[styles.input, { minHeight: 72 }]}
              placeholder="Comment (optional)"
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
                isSingleStopRoute ? "Book this stop with a free slot" : "Book all stops with a free slot"
              }
            >
              {bookingAction === "all" ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={primaryPressableTextStyle}>{isSingleStopRoute ? "Book" : "Book all"}</Text>
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
                accessibilityLabel="Book selected stops that have a free slot"
              >
                {bookingAction === "partial" ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={primaryPressableTextStyle}>
                    Partial book
                    {partialBookEnabled ? ` (${selectedBookableStops.length})` : ""}
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
                <Text style={{ color: colors.primary, fontWeight: "700" }}>Retry failed ({failedStops.length})</Text>
              </Pressable>
            ) : null}
            {lastBookResults ? (
              <View style={{ gap: 6 }}>
                {lastBookResults.map((r, idx) => (
                  <Text key={idx} style={{ color: r.ok ? colors.textMuted : "#c45c26", fontSize: 12 }}>
                    {r.stop.name}: {r.ok ? "added to Bookings" : r.message}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <Pressable onPress={() => resetVibePlan()} style={{ alignItems: "center" }}>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>Clear plan</Text>
        </Pressable>
      </ScrollView>

      <BottomSheetPickerModal
        visible={cityPickerVisible}
        onClose={() => {
          setCitySearchQuery("");
          setCityPickerVisible(false);
        }}
        title="City"
        maxHeightFraction={0.72}
      >
        <View style={styles.citySearchBox}>
          <Ionicons name="search-outline" size={20} color={colors.textMuted} />
          <TextInput
            value={citySearchQuery}
            onChangeText={setCitySearchQuery}
            placeholder="Search city or country"
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
                {city.trim() === c ? <Text style={styles.pickerCheck}>Selected</Text> : null}
              </Pressable>
            ))}
          </View>
        ))}

        {filteredCityGroups.length === 0 ? (
          <View style={styles.cityPickerEmpty}>
            <Text style={styles.cityPickerEmptyText}>No cities match your search</Text>
          </View>
        ) : null}
      </BottomSheetPickerModal>
    </Animated.View>
  );
}
