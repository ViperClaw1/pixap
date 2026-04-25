import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/contexts/ThemeContext";
import { useCreateCartItem, useCartItems } from "@/hooks/useCartItems";
import { useAvailableSlots } from "@/hooks/useAvailableSlots";
import { usePixAI, type PixAIFlowPayload, type PixAIPlace, type PixAISlot } from "@/hooks/usePixAI";
import { useAuth } from "@/contexts/AuthContext";
import AuthScreen from "@/screens/AuthScreen";
import { navigateToCartMain } from "@/navigation/navigationHelpers";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { ALL_CITIES_OPTION, useAvailableCities } from "@/hooks/useBusinessCards";
import { useCategories } from "@/hooks/useCategories";
import { useProfile } from "@/hooks/useProfile";
import { BottomSheetPickerModal } from "@/components/BottomSheetPickerModal";
import { SmartImage } from "@/components/SmartImage";
import { getLatestBusinessCardImage } from "@/lib/businessCardImages";
import { useEntitlement } from "@/hooks/useEntitlement";
import SubscriptionPaywallScreen from "@/screens/SubscriptionPaywallScreen";

type DraftForm = {
  persons: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  comment: string;
};

const PHONE_REGEX = /^\d-\(\d{3}\)-\d{3}-\d{4}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESTAURANT_TABLE_KEY = "restaurant-table";
const DEFAULT_RADIUS_MILES = 5;
const CALENDAR_MONTHS_AHEAD = 6;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

type FlowStep = "city" | "category" | "scope" | "places" | "booking";

type CalendarCell = { kind: "pad" } | { kind: "day"; ymd: string; day: number };

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthKey(d: Date): number {
  return d.getFullYear() * 12 + d.getMonth();
}

function firstOfMonthContaining(d: Date): Date {
  const x = startOfLocalDay(d);
  return new Date(x.getFullYear(), x.getMonth(), 1);
}

function buildMonthCells(year: number, month: number): CalendarCell[] {
  const lead = new Date(year, month, 1).getDay();
  const dim = new Date(year, month + 1, 0).getDate();
  const cells: CalendarCell[] = [];
  for (let i = 0; i < lead; i++) cells.push({ kind: "pad" });
  for (let d = 1; d <= dim; d++) {
    cells.push({ kind: "day", day: d, ymd: toYmd(new Date(year, month, d)) });
  }
  while (cells.length % 7 !== 0) cells.push({ kind: "pad" });
  return cells;
}

function chunkCells<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const validationSchema = {
  persons: (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 1;
  },
  customer_name: (value: string) => value.trim().length > 0,
  customer_phone: (value: string) => PHONE_REGEX.test(value.trim()),
  customer_email: (value: string) => EMAIL_REGEX.test(value.trim()),
};

function formatPhoneMask(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  let masked = digits[0];
  if (digits.length > 1) masked += "-(" + digits.slice(1, Math.min(4, digits.length));
  // Add closing parenthesis only after user types the next digit,
  // so backspace near this boundary does not get stuck.
  if (digits.length > 4) masked += ")-" + digits.slice(4, Math.min(7, digits.length));
  if (digits.length > 7) masked += "-" + digits.slice(7, 11);
  return masked;
}

export default function AIBookingScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const { isActive, isLoading: entitlementLoading } = useEntitlement();
  const navigation = useNavigation();
  const { messages, runFlow, isLoading } = usePixAI();
  const { data: profile } = useProfile();
  const { data: availableCities = [ALL_CITIES_OPTION] } = useAvailableCities();
  const { data: categories = [] } = useCategories();
  const createCartItem = useCreateCartItem();
  const { data: cartItems = [] } = useCartItems();
  const [currentStep, setCurrentStep] = useState<FlowStep>("city");
  const [selectedCity, setSelectedCity] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>("");
  const [commentInputHeight, setCommentInputHeight] = useState(88);
  const [scope, setScope] = useState<"nearby" | "city">("city");
  const [requestComment, setRequestComment] = useState("");
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PixAIPlace | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<PixAISlot | null>(null);
  const [bookingDateYmd, setBookingDateYmd] = useState<string | null>(null);
  const [visibleCalendarMonth, setVisibleCalendarMonth] = useState<Date>(() => firstOfMonthContaining(new Date()));
  const [cityPickerVisible, setCityPickerVisible] = useState(false);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [form, setForm] = useState<DraftForm>({
    persons: "2",
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    comment: "",
  });

  const stylesThemed = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background },
        scroll: { padding: 16, paddingTop: Math.max(12, insets.top), paddingBottom: 130 + insets.bottom, gap: 14 },
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
        title: { color: colors.text, fontSize: 24, fontWeight: "800" },
        subtitle: { color: colors.textMuted, marginTop: 2 },
        /** Bordered block for each major step / semantic region (scroll `gap` separates sections). */
        semanticSection: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          borderRadius: 12,
          padding: 12,
          gap: 10,
        },
        stepTitle: { color: colors.text, fontWeight: "700", fontSize: 15 },
        optionChip: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 8,
          marginBottom: 6,
        },
        optionChipSelected: { borderColor: colors.primary, backgroundColor: colors.border },
        optionChipText: { color: colors.text, fontWeight: "600" },
        bubble: {
          backgroundColor: colors.background,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 14,
          padding: 12,
        },
        bubbleUser: { backgroundColor: colors.primary, borderColor: colors.primary },
        bubbleText: { color: colors.text },
        bubbleUserText: { color: colors.onPrimary },
        label: { color: colors.textMuted, fontSize: 11, marginBottom: 2, textTransform: "uppercase", fontWeight: "700" },
        placeCard: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
          borderRadius: 12,
          padding: 10,
        },
        placeCardSelected: { borderColor: colors.primary },
        placeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
        placeThumb: {
          width: 74,
          height: 74,
          borderRadius: 10,
          backgroundColor: colors.border,
        },
        placeTextCol: { flex: 1, minWidth: 0 },
        placeName: { color: colors.text, fontWeight: "700" },
        placeMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
        /** Calendar panel inside Step 5 section (outer `semanticSection` provides the border). */
        calendarPanel: {
          borderRadius: 10,
          padding: 8,
          marginTop: 4,
          backgroundColor: colors.background,
        },
        calendarNav: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        },
        calendarNavBtn: { padding: 8, borderRadius: 8 },
        calendarNavBtnDisabled: { opacity: 0.35 },
        calendarMonthTitle: { color: colors.text, fontWeight: "800", fontSize: 16 },
        calendarDowRow: { flexDirection: "row", marginBottom: 4 },
        calendarDowCell: {
          flex: 1,
          textAlign: "center",
          color: colors.textMuted,
          fontSize: 11,
          fontWeight: "700",
        },
        calendarWeekRow: { flexDirection: "row", alignItems: "center" },
        calendarCell: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 4 },
        calendarCellDayInner: {
          minWidth: 38,
          minHeight: 38,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: "transparent",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
        },
        calendarCellDayText: { color: colors.text, fontSize: 15, fontWeight: "700" },
        calendarCellToday: { borderStyle: "dashed", borderColor: colors.border },
        calendarCellSelected: { borderColor: colors.primary, backgroundColor: colors.border },
        calendarCellPast: { opacity: 0.38 },
        calendarHint: { color: colors.textMuted, fontSize: 12 },
        slotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
        slotChip: {
          minWidth: 76,
          alignItems: "center",
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 8,
          paddingVertical: 8,
          paddingHorizontal: 10,
          backgroundColor: colors.background,
        },
        slotChipSelected: { borderColor: colors.primary, backgroundColor: colors.border },
        slotChipUnavailable: { opacity: 0.45 },
        slotText: { color: colors.text, fontSize: 12, fontWeight: "600" },
        field: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          color: colors.text,
          backgroundColor: colors.card,
          marginBottom: 8,
        },
        /** Inputs on top of `semanticSection` (card) background */
        fieldOnCard: {
          backgroundColor: colors.background,
          marginBottom: 0,
        },
        formFieldsStack: { gap: 8 },
        summaryText: { color: colors.textMuted, fontSize: 12, lineHeight: 16 },
        commentField: {
          minHeight: 88,
          textAlignVertical: "top",
        },
        helperText: { color: colors.textMuted, fontSize: 12 },
        footer: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: Math.max(10, insets.bottom),
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.background,
          gap: 8,
        },
        row: { flexDirection: "row", alignItems: "center", gap: 8 },
        secondaryBtn: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 11,
          backgroundColor: colors.background,
        },
        secondaryBtnText: { color: colors.text, fontWeight: "700" },
        draftBtn: {
          backgroundColor: colors.primary,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 12,
        },
        draftBtnText: { color: colors.onPrimary, fontWeight: "700" },
        dropdownTrigger: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 12,
          backgroundColor: colors.background,
        },
        dropdownTriggerText: { color: colors.text, fontWeight: "600", flex: 1, marginRight: 8 },
        dropdownPlaceholder: { color: colors.textMuted, fontWeight: "500" },
        pickerRow: {
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        pickerRowText: { color: colors.text, fontSize: 15 },
        pickerCheck: { color: colors.primary, fontWeight: "700", fontSize: 12 },
      }),
    [colors, insets.bottom, insets.top],
  );

  useEffect(() => {
    const city = profile?.city?.trim();
    if (!city) return;
    setSelectedCity(city);
    setCurrentStep((prev) => (prev === "city" ? "category" : prev));
  }, [profile?.city]);

  useEffect(() => {
    if (!profile) return;

    const defaultFullName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
    const defaultPhone = formatPhoneMask(profile.phone ?? "");
    const defaultEmail = (profile.email ?? "").trim();

    setForm((prev) => ({
      ...prev,
      customer_name: prev.customer_name.trim().length > 0 ? prev.customer_name : defaultFullName,
      customer_phone: prev.customer_phone.trim().length > 0 ? prev.customer_phone : defaultPhone,
      customer_email: prev.customer_email.trim().length > 0 ? prev.customer_email : defaultEmail,
    }));
  }, [profile]);

  const latestToolResult = [...messages]
    .reverse()
    .find((m) => m.role === "assistant" && m.toolResult)?.toolResult;

  const placeOptions = latestToolResult?.places ?? [];

  const {
    data: slotsForDate = [],
    isFetching: slotsFetching,
    isError: slotsError,
    refetch: refetchSlots,
  } = useAvailableSlots(selectedPlace?.id ?? null, bookingDateYmd);

  const cartReservedSlotTimes = useMemo(() => {
    const s = new Set<number>();
    if (!selectedPlace) return s;
    for (const it of cartItems) {
      if (it.business_card_id !== selectedPlace.id) continue;
      s.add(new Date(it.date_time).getTime());
    }
    return s;
  }, [cartItems, selectedPlace]);

  const todayYmd = toYmd(startOfLocalDay(new Date()));
  const earliestBookableMonth = firstOfMonthContaining(new Date());
  const latestBookableMonth = new Date(
    earliestBookableMonth.getFullYear(),
    earliestBookableMonth.getMonth() + CALENDAR_MONTHS_AHEAD,
    1,
  );
  const canGoPrevMonth = monthKey(visibleCalendarMonth) > monthKey(earliestBookableMonth);
  const canGoNextMonth = monthKey(visibleCalendarMonth) < monthKey(latestBookableMonth);

  const calendarCells = useMemo(
    () => buildMonthCells(visibleCalendarMonth.getFullYear(), visibleCalendarMonth.getMonth()),
    [visibleCalendarMonth],
  );

  const isRestaurantTable = selectedCategoryId === RESTAURANT_TABLE_KEY;

  const selectedCategoryRow = categories.find((c) => c.id === selectedCategoryId);
  const categoryDropdownLabel = isRestaurantTable
    ? "Restaurant table"
    : selectedCategoryRow
      ? `${selectedCategoryRow.icon ?? ""} ${selectedCategoryRow.name}`.trim()
      : selectedCategoryName || "Select service or table";

  const summaryMessage = [
    `City: ${selectedCity || "Not selected"}`,
    `Request: ${isRestaurantTable ? "Restaurant table" : (selectedCategoryName || "Not selected")}`,
    `Scope: ${scope === "nearby" ? "Near me (5 miles)" : "All places in city"}`,
    selectedPlace ? `Place: ${selectedPlace.name}` : null,
    requestComment.trim() ? `Comment: ${requestComment.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const onRequestNearbyPermission = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      Alert.alert("Location is required", "To search near you, allow fine location permission.");
      return null;
    }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    setLocationCoords(coords);
    return coords;
  };

  const onSearchPlaces = async () => {
    if (!selectedCity || selectedCity === ALL_CITIES_OPTION) {
      Alert.alert("Choose city", "Select your city before searching.");
      return;
    }
    if (!selectedCategoryId) {
      Alert.alert("Choose request", "Select a category or restaurant table.");
      return;
    }

    let coords = locationCoords;
    if (scope === "nearby" && !coords) {
      coords = await onRequestNearbyPermission();
      if (!coords) return;
    }

    const payload: PixAIFlowPayload = {
      city: selectedCity.trim(),
      categoryId: isRestaurantTable ? undefined : selectedCategoryId.trim(),
      categoryName: isRestaurantTable ? "Restaurant table" : selectedCategoryName,
      isRestaurantTable,
      comment: requestComment.trim() || undefined,
      mode: scope,
      radiusMiles: DEFAULT_RADIUS_MILES,
      location: scope === "nearby" ? coords ?? undefined : undefined,
      limit: 8,
    };

    await runFlow(payload);
    setHasSearched(true);
    setCurrentStep("places");
  };

  const onSelectPlace = (place: PixAIPlace) => {
    setSelectedPlace(place);
    setBookingDateYmd(null);
    setSelectedSlot(null);
    setVisibleCalendarMonth(firstOfMonthContaining(new Date()));
    setCurrentStep("booking");
  };

  const onCreateDraft = async () => {
    if (!selectedPlace || !selectedSlot) {
      Alert.alert("Missing selection", "Choose a place and a slot first.");
      return;
    }
    const persons = Number(form.persons);
    if (!validationSchema.persons(form.persons)) {
      Alert.alert("Invalid persons", "Please enter at least 1 person.");
      return;
    }
    if (!validationSchema.customer_name(form.customer_name)) {
      Alert.alert("Missing details", "Name is required.");
      return;
    }
    if (!validationSchema.customer_phone(form.customer_phone)) {
      Alert.alert("Invalid phone", "Use format X-(XXX)-XXX-XXXX.");
      return;
    }
    if (!validationSchema.customer_email(form.customer_email)) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }

    try {
      await createCartItem.mutateAsync({
        business_card_id: selectedPlace.id,
        date_time: selectedSlot.dateTimeIso,
        cost: Number(selectedPlace.booking_price ?? 0),
        persons,
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim(),
        customer_email: form.customer_email.trim(),
        comment: form.comment.trim() || null,
        is_restaurant_table: isRestaurantTable,
      });
      Alert.alert("Added to cart", "Your AI booking draft is ready for confirmation in Cart.");
      navigateToCartMain(navigation as unknown as NavigationProp<ParamListBase>);
    } catch {
      Alert.alert("Failed", "Could not create booking draft.");
    }
  };

  if (!user) return <AuthScreen />;
  if (entitlementLoading) {
    return (
      <View style={[stylesThemed.root, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!isActive) return <SubscriptionPaywallScreen />;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={stylesThemed.root}>
      <ScrollView style={stylesThemed.root} contentContainerStyle={stylesThemed.scroll}>
        <View style={stylesThemed.semanticSection}>
          <View style={stylesThemed.topRow}>
            <Pressable style={stylesThemed.backBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={18} color={colors.text} />
            </Pressable>
            <Text style={stylesThemed.title}>PixAI Smart Booking</Text>
          </View>
          <Text style={stylesThemed.subtitle}>
            Describe what you need and PixAI will suggest places and slots.
          </Text>
        </View>

        {currentStep === "city" ? (
          <View style={stylesThemed.semanticSection}>
            <Text style={stylesThemed.stepTitle}>Step 1. Choose city</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose city"
              style={stylesThemed.dropdownTrigger}
              onPress={() => setCityPickerVisible(true)}
            >
              <Text
                style={[stylesThemed.dropdownTriggerText, !selectedCity && stylesThemed.dropdownPlaceholder]}
                numberOfLines={1}
              >
                {selectedCity || "Select city"}
              </Text>
              <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : null}

        {currentStep === "category" ? (
          <View style={stylesThemed.semanticSection}>
            <Text style={stylesThemed.stepTitle}>Step 2. Choose service or table</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose service or table"
              style={stylesThemed.dropdownTrigger}
              onPress={() => setCategoryPickerVisible(true)}
            >
              <Text
                style={[
                  stylesThemed.dropdownTriggerText,
                  !selectedCategoryId && stylesThemed.dropdownPlaceholder,
                ]}
                numberOfLines={2}
              >
                {categoryDropdownLabel}
              </Text>
              <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
            </Pressable>
            <TextInput
              style={[stylesThemed.field, stylesThemed.fieldOnCard, stylesThemed.commentField, { height: commentInputHeight }]}
              multiline
              value={requestComment}
              onContentSizeChange={(event) => setCommentInputHeight(Math.min(180, Math.max(88, event.nativeEvent.contentSize.height + 10)))}
              onChangeText={setRequestComment}
              placeholder="Optional comment (preferences, budget, atmosphere...)"
              placeholderTextColor={colors.textMuted}
            />
            <Pressable style={stylesThemed.draftBtn} onPress={() => setCurrentStep("scope")}>
              <Text style={stylesThemed.draftBtnText}>Continue</Text>
            </Pressable>
          </View>
        ) : null}

        {currentStep === "scope" ? (
          <View style={stylesThemed.semanticSection}>
            <Text style={stylesThemed.stepTitle}>Step 3. Choose search scope</Text>
            <Pressable
              style={[stylesThemed.optionChip, scope === "nearby" && stylesThemed.optionChipSelected]}
              onPress={() => setScope("nearby")}
            >
              <Text style={stylesThemed.optionChipText}>Near me (5 miles)</Text>
            </Pressable>
            <Pressable
              style={[stylesThemed.optionChip, scope === "city" && stylesThemed.optionChipSelected]}
              onPress={() => setScope("city")}
            >
              <Text style={stylesThemed.optionChipText}>All places in my city</Text>
            </Pressable>
            <Text style={stylesThemed.helperText}>
              Nearby search will ask for fine location permission only when you start search.
            </Text>
            <Pressable style={stylesThemed.draftBtn} onPress={() => void onSearchPlaces()}>
              <Text style={stylesThemed.draftBtnText}>{isLoading ? "Searching..." : "Search places"}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={stylesThemed.semanticSection}>
          {messages.map((m) => (
            <View key={m.id} style={[stylesThemed.bubble, m.role === "user" && stylesThemed.bubbleUser]}>
              <Text style={m.role === "user" ? stylesThemed.bubbleUserText : stylesThemed.bubbleText}>{m.content}</Text>
            </View>
          ))}
        </View>

        {(currentStep === "places" || currentStep === "booking") && hasSearched && placeOptions.length > 0 ? (
          <View style={stylesThemed.semanticSection}>
            <Text style={stylesThemed.label}>Step 4. Suggested places</Text>
            {placeOptions.map((place) => (
              <Pressable
                key={place.id}
                onPress={() => onSelectPlace(place)}
                style={[stylesThemed.placeCard, selectedPlace?.id === place.id && stylesThemed.placeCardSelected]}
              >
                <View style={stylesThemed.placeRow}>
                  <SmartImage
                    uri={getLatestBusinessCardImage(place.images)}
                    recyclingKey={place.id}
                    style={stylesThemed.placeThumb}
                    contentFit="cover"
                  />
                  <View style={stylesThemed.placeTextCol}>
                    <Text style={stylesThemed.placeName} numberOfLines={2}>
                      {place.name}
                    </Text>
                    <Text style={stylesThemed.placeMeta} numberOfLines={2}>
                      {place.city ?? "City not set"} • {place.address ?? "No address"} • {Number(place.rating).toFixed(1)}★
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        {currentStep === "booking" && selectedPlace ? (
          <View style={stylesThemed.semanticSection}>
            <Text style={stylesThemed.label}>Step 5. Available slots</Text>
            <Text style={stylesThemed.calendarHint} numberOfLines={2}>
              Pick a date for {selectedPlace.name}, then choose a time.
            </Text>
            <View style={stylesThemed.calendarPanel}>
              <View style={stylesThemed.calendarNav}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Previous month"
                  disabled={!canGoPrevMonth}
                  onPress={() =>
                    setVisibleCalendarMonth((prev) => {
                      const y = prev.getFullYear();
                      const m = prev.getMonth();
                      return new Date(y, m - 1, 1);
                    })
                  }
                  style={[stylesThemed.calendarNavBtn, !canGoPrevMonth && stylesThemed.calendarNavBtnDisabled]}
                >
                  <Ionicons name="chevron-back" size={22} color={colors.text} />
                </Pressable>
                <Text style={stylesThemed.calendarMonthTitle}>
                  {visibleCalendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Next month"
                  disabled={!canGoNextMonth}
                  onPress={() =>
                    setVisibleCalendarMonth((prev) => {
                      const y = prev.getFullYear();
                      const m = prev.getMonth();
                      return new Date(y, m + 1, 1);
                    })
                  }
                  style={[stylesThemed.calendarNavBtn, !canGoNextMonth && stylesThemed.calendarNavBtnDisabled]}
                >
                  <Ionicons name="chevron-forward" size={22} color={colors.text} />
                </Pressable>
              </View>
              <View style={stylesThemed.calendarDowRow}>
                {WEEKDAY_LABELS.map((label) => (
                  <Text key={label} style={stylesThemed.calendarDowCell}>
                    {label}
                  </Text>
                ))}
              </View>
              {chunkCells(calendarCells, 7).map((row, rowIdx) => (
                <View key={`w-${rowIdx}`} style={stylesThemed.calendarWeekRow}>
                  {row.map((cell, colIdx) => {
                    if (cell.kind === "pad") {
                      return <View key={`p-${rowIdx}-${colIdx}`} style={stylesThemed.calendarCell} />;
                    }
                    const { ymd, day } = cell;
                    const isSelected = bookingDateYmd === ymd;
                    const isToday = ymd === todayYmd;
                    const isPast = ymd < todayYmd;
                    return (
                      <View key={ymd} style={stylesThemed.calendarCell}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${ymd}`}
                          disabled={isPast}
                          onPress={() => {
                            setBookingDateYmd(ymd);
                            setSelectedSlot(null);
                          }}
                          style={[
                            stylesThemed.calendarCellDayInner,
                            isToday && stylesThemed.calendarCellToday,
                            isSelected && stylesThemed.calendarCellSelected,
                            isPast && stylesThemed.calendarCellPast,
                          ]}
                        >
                          <Text style={stylesThemed.calendarCellDayText}>{day}</Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>

            {!bookingDateYmd ? (
              <Text style={stylesThemed.calendarHint}>Select a date to load time slots.</Text>
            ) : slotsFetching ? (
              <ActivityIndicator style={{ marginTop: 16 }} color={colors.primary} />
            ) : slotsError ? (
              <View style={{ marginTop: 12, gap: 8 }}>
                <Text style={stylesThemed.helperText}>Could not load slots.</Text>
                <Pressable style={stylesThemed.secondaryBtn} onPress={() => void refetchSlots()}>
                  <Text style={stylesThemed.secondaryBtnText}>Retry</Text>
                </Pressable>
              </View>
            ) : slotsForDate.length === 0 ? (
              <Text style={stylesThemed.calendarHint}>No time slots for this date.</Text>
            ) : (
              <View style={[stylesThemed.slotGrid, { marginTop: 10 }]}>
                {slotsForDate.map((slot) => {
                  const inCart = cartReservedSlotTimes.has(new Date(slot.dateTimeIso).getTime());
                  const disabled = !slot.available || inCart;
                  return (
                    <Pressable
                      disabled={disabled}
                      key={slot.dateTimeIso}
                      onPress={() => setSelectedSlot(slot)}
                      style={[
                        stylesThemed.slotChip,
                        selectedSlot?.dateTimeIso === slot.dateTimeIso && stylesThemed.slotChipSelected,
                        disabled && stylesThemed.slotChipUnavailable,
                      ]}
                    >
                      <Text style={stylesThemed.slotText}>{slot.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}

        {currentStep === "booking" ? (
          <>
            <View style={stylesThemed.semanticSection}>
              <Text style={stylesThemed.label}>Booking details</Text>
              <Text style={stylesThemed.summaryText}>{summaryMessage}</Text>
            </View>
            <View style={stylesThemed.semanticSection}>
              <View style={stylesThemed.formFieldsStack}>
                <TextInput
                  style={[stylesThemed.field, stylesThemed.fieldOnCard]}
                  keyboardType="number-pad"
                  value={form.persons}
                  onChangeText={(persons) => setForm((prev) => ({ ...prev, persons }))}
                  placeholder="Persons"
                  placeholderTextColor={colors.textMuted}
                />
                <TextInput
                  style={[stylesThemed.field, stylesThemed.fieldOnCard]}
                  value={form.customer_name}
                  onChangeText={(customer_name) => setForm((prev) => ({ ...prev, customer_name }))}
                  placeholder="Full name"
                  placeholderTextColor={colors.textMuted}
                />
                <TextInput
                  style={[stylesThemed.field, stylesThemed.fieldOnCard]}
                  value={form.customer_phone}
                  onChangeText={(customer_phone) =>
                    setForm((prev) => ({ ...prev, customer_phone: formatPhoneMask(customer_phone) }))
                  }
                  keyboardType="number-pad"
                  placeholder="X-(XXX)-XXX-XXXX"
                  placeholderTextColor={colors.textMuted}
                />
                <TextInput
                  style={[stylesThemed.field, stylesThemed.fieldOnCard]}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={form.customer_email}
                  onChangeText={(customer_email) => setForm((prev) => ({ ...prev, customer_email }))}
                  placeholder="Email"
                  placeholderTextColor={colors.textMuted}
                />
                <TextInput
                  style={[stylesThemed.field, stylesThemed.fieldOnCard, stylesThemed.commentField]}
                  multiline
                  value={form.comment}
                  onChangeText={(comment) => setForm((prev) => ({ ...prev, comment }))}
                  placeholder="Optional comment"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <Pressable style={stylesThemed.draftBtn} onPress={() => void onCreateDraft()}>
                <Text style={stylesThemed.draftBtnText}>Add booking draft to cart</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </ScrollView>

      <BottomSheetPickerModal
        visible={cityPickerVisible}
        onClose={() => setCityPickerVisible(false)}
        title="Choose city"
      >
        {availableCities
          .filter((city) => city !== ALL_CITIES_OPTION)
          .map((city) => (
            <Pressable
              key={city}
              style={stylesThemed.pickerRow}
              onPress={() => {
                setSelectedCity(city);
                setCityPickerVisible(false);
                setCurrentStep("category");
              }}
            >
              <Text style={stylesThemed.pickerRowText}>{city}</Text>
              {selectedCity === city ? <Text style={stylesThemed.pickerCheck}>Selected</Text> : null}
            </Pressable>
          ))}
      </BottomSheetPickerModal>

      <BottomSheetPickerModal
        visible={categoryPickerVisible}
        onClose={() => setCategoryPickerVisible(false)}
        title="Choose service or table"
      >
        {categories.map((category) => (
          <Pressable
            key={category.id}
            style={stylesThemed.pickerRow}
            onPress={() => {
              setSelectedCategoryId(category.id);
              setSelectedCategoryName(category.name);
              setCategoryPickerVisible(false);
            }}
          >
            <Text style={stylesThemed.pickerRowText}>
              {category.icon} {category.name}
            </Text>
            {selectedCategoryId === category.id ? <Text style={stylesThemed.pickerCheck}>Selected</Text> : null}
          </Pressable>
        ))}
        <Pressable
          style={stylesThemed.pickerRow}
          onPress={() => {
            setSelectedCategoryId(RESTAURANT_TABLE_KEY);
            setSelectedCategoryName("Restaurant table");
            setCategoryPickerVisible(false);
          }}
        >
          <Text style={stylesThemed.pickerRowText}>Restaurant table</Text>
          {isRestaurantTable ? <Text style={stylesThemed.pickerCheck}>Selected</Text> : null}
        </Pressable>
      </BottomSheetPickerModal>

      <View style={stylesThemed.footer}>
        <View style={stylesThemed.row}>
          {currentStep !== "city" ? (
            <Pressable
              style={[stylesThemed.secondaryBtn, { flex: 1 }]}
              onPress={() =>
                setCurrentStep((step) =>
                  step === "booking" ? "places" : step === "places" ? "scope" : step === "scope" ? "category" : "city",
                )
              }
            >
              <Text style={stylesThemed.secondaryBtnText}>Back step</Text>
            </Pressable>
          ) : null}
          {currentStep === "places" ? (
            <Pressable style={[stylesThemed.draftBtn, { flex: 1 }]} onPress={() => setCurrentStep("scope")}>
              <Text style={stylesThemed.draftBtnText}>Refine search</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
