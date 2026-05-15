import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useKeyboardInset } from "@/shared/lib/keyboard";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CommonActions, useNavigation, type NavigationProp, type ParamListBase } from "@react-navigation/native";
import { useQueries } from "@tanstack/react-query";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { useAuth } from "@/app/providers/AuthProvider";
import { useAuthSessionRedirect } from "@/features/auth-session-redirect";
import { useSubscriptionPaywallRedirect } from "@/features/subscription-paywall-redirect";
import { useEntitlement } from "@/entities/subscription";
import { useProfile } from "@/entities/user";
import { usePixAI, type PixAIVibeTimeline, type VibePlanStop, type PixAISlot } from "@/entities/pixai";
import { fetchAvailableSlotsForDay, useCreateBooking } from "@/entities/booking";
import { useCreateCartItem } from "@/entities/cart";
import { supabase } from "@/shared/api/supabase/client";
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
import { toYmd } from "@/shared/lib/bookingCalendar";
import { useAndroidFullSwipeBackPanHandlers } from "@/shared/lib/useAndroidFullSwipeBackPanHandlers";

const MOOD_PRESETS = ["romantic evening", "drunk friday", "family brunch", "solo chill", "celebration night"] as const;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SLOT_MATCH_MS = 45 * 60 * 1000;

function scheduleN8nWaBookingStart(cartItemId: string, accessToken: string) {
  void supabase.functions
    .invoke("n8n-wa-booking-start", {
      body: { cart_item_id: cartItemId },
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    .then((res) => {
      const { error, data } = res;
      if (!error) return;
      let details = error.message;
      const rawBody = (error as { context?: { body?: string } }).context?.body;
      if (rawBody) {
        try {
          const parsed = JSON.parse(rawBody) as { error?: string; step?: string; hint?: string };
          details = `${parsed.error ?? error.message}${parsed.step ? ` [${parsed.step}]` : ""}${
            parsed.hint ? ` — ${parsed.hint}` : ""
          }`;
        } catch {
          details = `${details} ${rawBody.slice(0, 220)}`;
        }
      } else if (data && typeof data === "object" && data !== null && "error" in data) {
        const parsed = data as { error?: string; step?: string; hint?: string };
        details = `${parsed.error ?? error.message}${parsed.step ? ` [${parsed.step}]` : ""}${
          parsed.hint ? ` — ${parsed.hint}` : ""
        }`;
      }
      console.warn("[n8n-wa-booking-start] invoke failed", details);
    })
    .catch((error) => {
      if (__DEV__) {
        console.warn("[n8n-wa-booking-start] invoke failed", error);
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

export default function VibeMatchPage() {
  const insets = useSafeAreaInsets();
  const keyboardInset = useKeyboardInset({ bottomInset: insets.bottom });
  const keyboardRootStyle = useAnimatedStyle(
    () => ({ paddingBottom: keyboardInset.value }),
    [keyboardInset],
  );
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const androidSwipeBackPanHandlers = useAndroidFullSwipeBackPanHandlers(navigation);
  const { user, session, loading: authLoading } = useAuth();
  const { hasSubscriptionAccess, isLoading: entitlementLoading } = useEntitlement();
  const shouldEnforcePaywall = !__DEV__ && Constants.appOwnership !== "expo";

  useAuthSessionRedirect({
    authLoading,
    hasUser: Boolean(user),
    navigation: navigation as unknown as NavigationProp<ParamListBase>,
  });
  useSubscriptionPaywallRedirect({
    entitlementLoading,
    shouldEnforcePaywall,
    hasSubscriptionAccess,
    navigation: navigation as { navigate: (name: "SubscriptionPaywall") => void },
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
  const bookingBusy = bookingAction !== null;

  const plan = vibeResult?.plan ?? [];

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
  const anyBookable = stopAvailability.some((x) => x.bookable);
  const allBookable =
    plan.length > 0 && stopAvailability.every((x) => x.bookable) && slotsAvailabilityReady;
  const partialBookEnabled = slotsAvailabilityReady && anyBookable && !allBookable;

  const bookableStops = useMemo(
    () => plan.filter((_, i) => stopAvailability[i]?.bookable),
    [plan, stopAvailability],
  );

  const stylesThemed = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background },
        scroll: { padding: 16, paddingTop: Math.max(12, insets.top), paddingBottom: 32 + insets.bottom, gap: 14 },
        topRow: { flexDirection: "row", alignItems: "center", gap: 10 },
        backBtn: {
          width: 36,
          height: 36,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          alignItems: "center",
          justifyContent: "center",
        },
        title: { color: colors.text, fontSize: 22, fontWeight: "800", flex: 1 },
        subtitle: { color: colors.textMuted, fontSize: 13 },
        section: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          borderRadius: 12,
          padding: 12,
          gap: 10,
        },
        label: { color: colors.textMuted, fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
        input: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: Platform.OS === "ios" ? 12 : 8,
          color: colors.text,
          backgroundColor: colors.background,
        },
        chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
        chip: {
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
        },
        chipOn: { borderColor: colors.primary, backgroundColor: colors.border },
        chipText: { color: colors.text, fontSize: 13, fontWeight: "600" },
        timelineRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
        planRow: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          padding: 10,
          gap: 6,
          backgroundColor: colors.background,
        },
        planRowWarn: { borderColor: "#c45c26" },
        planTime: { color: colors.primary, fontWeight: "800", fontSize: 14 },
        planName: { color: colors.text, fontWeight: "700", fontSize: 16 },
        planDesc: { color: colors.textMuted, fontSize: 13 },
        statusPill: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
        statusOk: { backgroundColor: "rgba(34,197,94,0.15)" },
        statusBad: { backgroundColor: "rgba(239,68,68,0.12)" },
        statusText: { fontSize: 11, fontWeight: "700" },
        errorBox: { padding: 12, borderRadius: 10, backgroundColor: "rgba(239,68,68,0.08)", borderWidth: 1, borderColor: colors.border },
        errorText: { color: colors.text, fontSize: 13 },
        emptyText: { color: colors.textMuted, textAlign: "center", padding: 16 },
        pickerRow: {
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        pickerRowText: { color: colors.text, fontSize: 15 },
        pickerCheck: { color: colors.primary, fontWeight: "700", fontSize: 12 },
        citySearchBox: {
          marginHorizontal: 14,
          marginBottom: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 12,
          height: 44,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
        },
        citySearchInput: {
          flex: 1,
          fontSize: 15,
          color: colors.text,
          paddingVertical: 0,
        },
        countryHeader: {
          paddingHorizontal: 14,
          paddingTop: 10,
          paddingBottom: 6,
          backgroundColor: colors.background,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        countryHeaderText: {
          fontSize: 12,
          fontWeight: "800",
          color: colors.textMuted,
          letterSpacing: 0.3,
          textTransform: "uppercase",
        },
        cityPickerEmpty: {
          paddingHorizontal: 14,
          paddingVertical: 20,
          alignItems: "center",
        },
        cityPickerEmptyText: { fontSize: 14, color: colors.textMuted, textAlign: "center" },
      }),
    [colors, insets.bottom, insets.top],
  );

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
              navigateToAuthScreen(navigation as unknown as NavigationProp<ParamListBase>);
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
          Alert.alert(
            anyPaid ? "Draft created" : "Booking confirmed",
            anyPaid
              ? `${okc} draft booking(s) in Bookings. Venue check runs in the background.`
              : `${okc} booking(s) are now in Bookings.`,
          );
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
    if (!allBookable) {
      Alert.alert("Availability", "Every stop needs a free slot near the suggested time. Wait for slots to load or adjust the plan.");
      return;
    }
    await runBookStops(plan, "all");
  }, [allBookable, plan, runBookStops]);

  const onPartialBook = useCallback(async () => {
    if (!partialBookEnabled || bookableStops.length === 0) return;
    await runBookStops(bookableStops, "partial");
  }, [bookableStops, partialBookEnabled, runBookStops]);

  const failedStops = useMemo(
    () => (lastBookResults?.filter((r): r is Extract<BookRowResult, { ok: false }> => !r.ok) ?? []).map((r) => r.stop),
    [lastBookResults],
  );

  const onRetryFailed = useCallback(async () => {
    if (failedStops.length === 0) return;
    await runBookStops(failedStops, "retry");
  }, [failedStops, runBookStops]);

  const errMsg = vibeError instanceof Error ? vibeError.message : vibeError ? String(vibeError) : "";

  return (
    <Animated.View style={[stylesThemed.root, keyboardRootStyle]} {...androidSwipeBackPanHandlers}>
      <ScrollView contentContainerStyle={stylesThemed.scroll} keyboardShouldPersistTaps="handled">
        <View style={stylesThemed.topRow}>
          <Pressable style={stylesThemed.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={stylesThemed.title}>PixAI Vibe Match</Text>
        </View>
        <Text style={stylesThemed.subtitle}>Mood + evening flow → one-tap multi-stop cart.</Text>

        <View style={stylesThemed.section}>
          <Text style={stylesThemed.label}>City</Text>
          <Pressable
            onPress={() => {
              setCitySearchQuery("");
              setCityPickerVisible(true);
            }}
            style={[stylesThemed.input, { justifyContent: "center" }]}
          >
            <Text style={{ color: city.trim() ? colors.text : colors.textMuted }}>
              {city.trim() || "Select city"}
            </Text>
          </Pressable>
          <Text style={stylesThemed.label}>Mood</Text>
          <TextInput
            style={stylesThemed.input}
            placeholder="e.g. romantic evening"
            placeholderTextColor={colors.textMuted}
            value={mood}
            onChangeText={setMood}
          />
          <View style={stylesThemed.chipRow}>
            {MOOD_PRESETS.map((p) => (
              <Pressable key={p} style={stylesThemed.chip} onPress={() => setMood(p)}>
                <Text style={stylesThemed.chipText}>{p}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={stylesThemed.label}>Timeline</Text>
          <View style={stylesThemed.timelineRow}>
            {(["evening", "night", "late_night"] as const).map((t) => (
              <Pressable
                key={t}
                onPress={() => setTimeline(t)}
                style={[stylesThemed.chip, timeline === t && stylesThemed.chipOn]}
              >
                <Text style={stylesThemed.chipText}>{t.replace("_", " ")}</Text>
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
            <View style={stylesThemed.errorBox}>
              <Text style={stylesThemed.errorText}>{errMsg || "Could not generate plan."}</Text>
              <Pressable onPress={onRetryGenerate} style={{ marginTop: 8 }}>
                <Text style={{ color: colors.primary, fontWeight: "700" }}>Retry</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {vibeResult && !isVibeLoading ? (
          <View style={stylesThemed.section}>
            <Text style={stylesThemed.label}>Concierge</Text>
            <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>{vibeResult.assistant}</Text>
          </View>
        ) : null}

        {vibeResult && plan.length === 0 && !isVibeLoading ? (
          <Text style={stylesThemed.emptyText}>No venues matched. Try another mood or city.</Text>
        ) : null}

        {plan.length > 0 ? (
          <View style={stylesThemed.section}>
            <Text style={stylesThemed.label}>Your route</Text>
            {plan.map((stop, i) => {
              const meta = stopAvailability[i];
              const warn = meta && !meta.loading && !meta.error && !meta.bookable;
              return (
                <View key={`${stop.venue_id}-${i}`} style={[stylesThemed.planRow, warn && stylesThemed.planRowWarn]}>
                  <Text style={stylesThemed.planTime}>
                    {new Date(stop.time_slot).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                  </Text>
                  <Text style={stylesThemed.planName}>{stop.name}</Text>
                  {stop.description ? <Text style={stylesThemed.planDesc}>{stop.description}</Text> : null}
                  <View style={[stylesThemed.statusPill, meta?.bookable ? stylesThemed.statusOk : stylesThemed.statusBad]}>
                    <Text style={[stylesThemed.statusText, { color: colors.text }]}>
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
              );
            })}
          </View>
        ) : null}

        {plan.length > 0 ? (
          <View style={stylesThemed.section}>
            <Text style={stylesThemed.label}>Guest details (cart)</Text>
            <TextInput
              style={stylesThemed.input}
              placeholder="Party size"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              value={persons}
              onChangeText={setPersons}
            />
            <TextInput
              style={stylesThemed.input}
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
              style={stylesThemed.input}
              placeholder="Email"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              value={customerEmail}
              onChangeText={setCustomerEmail}
            />
            <TextInput
              style={[stylesThemed.input, { minHeight: 72 }]}
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
                (!allBookable || bookingBusy) && { opacity: 0.55 },
              ]}
              disabled={!allBookable || bookingBusy}
              onPress={() => void onBookAll()}
              accessibilityLabel="Book all stops with a free slot"
            >
              {bookingAction === "all" ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={primaryPressableTextStyle}>Book all</Text>
              )}
            </Pressable>
            {!allBookable && plan.length > 0 && (anyBookable || !slotsAvailabilityReady) ? (
              <Pressable
                style={[
                  primaryPressableStyle,
                  { height: SHARED_PRESSABLE_HEIGHT, borderRadius: SHARED_PRESSABLE_RADIUS },
                  (!partialBookEnabled || bookingBusy) && { opacity: 0.55 },
                ]}
                disabled={!partialBookEnabled || bookingBusy}
                onPress={() => void onPartialBook()}
                accessibilityLabel="Book only stops that have a free slot"
              >
                {bookingAction === "partial" ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={primaryPressableTextStyle}>
                    Partial book{partialBookEnabled ? ` (${bookableStops.length})` : ""}
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
        <View style={stylesThemed.citySearchBox}>
          <Ionicons name="search-outline" size={20} color={colors.textMuted} />
          <TextInput
            value={citySearchQuery}
            onChangeText={setCitySearchQuery}
            placeholder="Search city or country"
            placeholderTextColor={colors.textMuted}
            style={stylesThemed.citySearchInput}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>

        {filteredCityGroups.map(({ country, cities }) => (
          <View key={country}>
            <View style={stylesThemed.countryHeader}>
              <Text style={stylesThemed.countryHeaderText}>{country}</Text>
            </View>
            {cities.map((c) => (
              <Pressable
                key={c}
                style={stylesThemed.pickerRow}
                onPress={() => {
                  setCity(c);
                  setCitySearchQuery("");
                  setCityPickerVisible(false);
                }}
              >
                <Text style={stylesThemed.pickerRowText}>{c}</Text>
                {city.trim() === c ? <Text style={stylesThemed.pickerCheck}>Selected</Text> : null}
              </Pressable>
            ))}
          </View>
        ))}

        {filteredCityGroups.length === 0 ? (
          <View style={stylesThemed.cityPickerEmpty}>
            <Text style={stylesThemed.cityPickerEmptyText}>No cities match your search</Text>
          </View>
        ) : null}
      </BottomSheetPickerModal>
    </Animated.View>
  );
}
