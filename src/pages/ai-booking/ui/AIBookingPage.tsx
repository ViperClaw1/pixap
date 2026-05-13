import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useKeyboardInset } from "@/shared/lib/keyboard";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/contexts/ThemeContext";
import { useCartItems, useCreateCartItem } from "@/entities/cart";
import { useCreateBooking } from "@/entities/booking";
import { useAvailableSlots } from "@/entities/booking";
import { usePixAI, type PixAIFlowPayload, type PixAIPlace, type PixAISlot } from "@/entities/pixai";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthSessionRedirect } from "@/features/auth-session-redirect";
import { useSubscriptionPaywallRedirect } from "@/features/subscription-paywall-redirect";
import { CommonActions, useNavigation } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import {
  ALL_CITIES_OPTION,
  useAvailableCities,
  groupCitiesByCountry,
  filterCityGroups,
} from "@/entities/business-card";
import { useCategories, CategoryIcon, resolveCategoryIconSpec } from "@/entities/category";
import { useProfile } from "@/entities/user";
import { isProfileComplete } from "@/shared/lib/profileCompletion";
import { BottomSheetPickerModal } from "@/shared/ui/bottom-sheet-picker/BottomSheetPickerModal";
import { useEntitlement } from "@/entities/subscription";
import { isAuthRequiredError, navigateToAuthScreen } from "@/lib/authRequired";
import { supabase } from "@/shared/api/supabase/client";
import {
  DEFAULT_PHONE_VALUE,
  parseStoredPhone,
  serializePhone,
  validatePhoneValue,
  type PhoneValue,
} from "@/shared/ui/phone-input";
import { createAIBookingStyles } from "./aiBookingStyles";
import { AIBookingTranscript } from "./AIBookingTranscript";
import { AIBookingSuggestedPlaces } from "./AIBookingSuggestedPlaces";
import { AIBookingSlotPicker } from "./AIBookingSlotPicker";
import { AIBookingCustomerForm, type AIBookingDraftForm } from "./AIBookingCustomerForm";
import {
  CALENDAR_MONTHS_AHEAD,
  startOfLocalDay,
  toYmd,
  monthKey,
  firstOfMonthContaining,
  buildMonthCells,
} from "@/shared/lib/bookingCalendar";
import { useAndroidFullSwipeBackPanHandlers } from "@/shared/lib/useAndroidFullSwipeBackPanHandlers";
import { useShallow } from "zustand/react/shallow";
import {
  BookingChatDock,
  buildBookingContextFromPage,
  buildEffectivePlaces,
  useBookingChatStore,
  type BookingRecommendationView,
} from "@/features/ai-booking-chat";

const DEFAULT_BOOKING_REC_VIEW: BookingRecommendationView = {
  rerankedPlaceIds: [],
  excludedPlaceIds: [],
  filters: {},
};

type DraftForm = AIBookingDraftForm;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESTAURANT_TABLE_KEY = "restaurant-table";
const DEFAULT_RADIUS_MILES = 5;

type FlowStep = "city" | "category" | "scope" | "places" | "booking";

const validationSchema = {
  persons: (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 1;
  },
  customer_name: (value: string) => value.trim().length > 0,
  customer_phone: (value: PhoneValue) => validatePhoneValue(value) === null,
  customer_email: (value: string) => EMAIL_REGEX.test(value.trim()),
};

export default function AIBookingPage() {
  const insets = useSafeAreaInsets();
  const keyboardInset = useKeyboardInset({ bottomInset: insets.bottom });
  const keyboardRootStyle = useAnimatedStyle(
    () => ({ paddingBottom: keyboardInset.value }),
    [keyboardInset],
  );
  const { colors } = useAppTheme();
  const { user, session, loading: authLoading } = useAuth();
  const { hasSubscriptionAccess, isLoading: entitlementLoading } = useEntitlement();
  const shouldEnforcePaywall = !__DEV__ && Constants.appOwnership !== "expo";
  const navigation = useNavigation();
  const androidSwipeBackPanHandlers = useAndroidFullSwipeBackPanHandlers(navigation);
  useAuthSessionRedirect({
    authLoading: authLoading,
    hasUser: Boolean(user),
    navigation: navigation as unknown as NavigationProp<ParamListBase>,
  });
  useSubscriptionPaywallRedirect({
    entitlementLoading,
    shouldEnforcePaywall,
    hasSubscriptionAccess,
    navigation: navigation as { navigate: (name: "SubscriptionPaywall") => void },
  });
  const { messages, runFlow, isLoading } = usePixAI();
  const { data: profile } = useProfile();
  const { data: availableCities = [ALL_CITIES_OPTION] } = useAvailableCities();
  const { data: categories = [] } = useCategories();
  const createCartItem = useCreateCartItem();
  const createBooking = useCreateBooking();
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
  const [citySearchQuery, setCitySearchQuery] = useState("");
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [form, setForm] = useState<DraftForm>({
    persons: "2",
    customer_name: "",
    customer_phone: DEFAULT_PHONE_VALUE,
    customer_email: "",
    comment: "",
  });
  const [catalogRevision, setCatalogRevision] = useState(0);

  const concreteCities = useMemo(
    () => availableCities.filter((c) => c !== ALL_CITIES_OPTION),
    [availableCities],
  );

  const filteredCityGroups = useMemo(() => {
    const grouped = groupCitiesByCountry(concreteCities);
    return filterCityGroups(grouped, citySearchQuery);
  }, [concreteCities, citySearchQuery]);

  const redirectToEditProfile = () => {
    navigation.getParent()?.dispatch(
      CommonActions.navigate({
        name: "Profile",
        params: { screen: "EditProfile" },
      }),
    );
  };

  const ensureProfileComplete = () => {
    if (isProfileComplete(profile)) return true;
    Alert.alert("Profile incomplete", "Please, fill out all your profile data before booking.");
    redirectToEditProfile();
    return false;
  };

  const stylesThemed = useMemo(
    () => createAIBookingStyles(colors, { top: insets.top, bottom: insets.bottom }),
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
    const defaultPhone = parseStoredPhone(profile.phone);
    const defaultEmail = (profile.email ?? "").trim();

    setForm((prev) => ({
      ...prev,
      customer_name: prev.customer_name.trim().length > 0 ? prev.customer_name : defaultFullName,
      customer_phone: prev.customer_phone.nationalDigits ? prev.customer_phone : defaultPhone,
      customer_email: prev.customer_email.trim().length > 0 ? prev.customer_email : defaultEmail,
    }));
  }, [profile]);

  const latestToolResult = [...messages]
    .reverse()
    .find((m) => m.role === "assistant" && m.toolResult)?.toolResult;

  const placeOptions = latestToolResult?.places ?? [];

  const recommendationView = useBookingChatStore(
    useShallow((s) => {
      const tab = s.tabs.find((t) => t.id === s.activeTabId);
      return tab?.recommendationView ?? DEFAULT_BOOKING_REC_VIEW;
    }),
  );

  const effectivePlaces = useMemo(
    () => buildEffectivePlaces(placeOptions, recommendationView),
    [placeOptions, recommendationView],
  );

  useEffect(() => {
    if (!selectedPlace) return;
    if (placeOptions.length === 0) return;
    if (effectivePlaces.some((p) => p.id === selectedPlace.id)) return;
    Alert.alert(
      "List updated",
      "The assistant removed or re-ranked places and your previous pick is no longer available. Choose another place.",
    );
    setSelectedPlace(null);
    setBookingDateYmd(null);
    setSelectedSlot(null);
    setCurrentStep("places");
  }, [effectivePlaces, placeOptions.length, selectedPlace]);

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

  const bookingChatContext = useMemo(
    () =>
      buildBookingContextFromPage({
        city: selectedCity,
        categoryLabel: isRestaurantTable ? "Restaurant table" : selectedCategoryName || "Service",
        scopeLabel: scope === "nearby" ? "Near me (5 miles)" : "All places in city",
        requestComment: requestComment.trim() || undefined,
        selectedPlace,
        bookingDateYmd,
        selectedSlot,
      }),
    [
      selectedCity,
      isRestaurantTable,
      selectedCategoryName,
      scope,
      requestComment,
      selectedPlace,
      bookingDateYmd,
      selectedSlot,
    ],
  );

  const selectedCategoryRow = categories.find((c) => c.id === selectedCategoryId);
  const categoryDropdownLabel = isRestaurantTable
    ? "Restaurant table"
    : selectedCategoryRow
      ? selectedCategoryRow.name
      : selectedCategoryName || "Select service or table";
  const selectedCategoryIconSpec = isRestaurantTable
    ? ({ family: "ionicons", name: "restaurant-outline" } as const)
    : selectedCategoryRow
      ? resolveCategoryIconSpec(selectedCategoryRow.name)
      : null;

  const summaryMessage = [
    `City: ${selectedCity || "Not selected"}`,
    `Request: ${isRestaurantTable ? "Restaurant table" : (selectedCategoryName || "Not selected")}`,
    `Scope: ${scope === "nearby" ? "Near me (5 miles)" : "All places in city"}`,
    selectedPlace ? `Place: ${selectedPlace.name}` : null,
    requestComment.trim() ? `Comment: ${requestComment.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const canContinueFromCategory = selectedCity !== "" && selectedCity !== ALL_CITIES_OPTION && selectedCategoryId.trim().length > 0;
  const continueValidationHint =
    selectedCity === "" || selectedCity === ALL_CITIES_OPTION
      ? "Select your city to continue."
      : selectedCategoryId.trim().length === 0
        ? "Select a service or table to continue."
        : null;

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
    if (!ensureProfileComplete()) return;
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

    try {
      await runFlow(payload);
      setHasSearched(true);
      setCurrentStep("places");
      setCatalogRevision((prev) => {
        const next = prev + 1;
        useBookingChatStore.getState().bumpCatalogRevision(next);
        return next;
      });
    } catch (error) {
      if (isAuthRequiredError(error)) {
        navigateToAuthScreen(navigation as unknown as NavigationProp<ParamListBase>);
        return;
      }
      Alert.alert("Failed", error instanceof Error ? error.message : "Could not search places.");
    }
  };

  const onSelectPlace = (place: PixAIPlace) => {
    setSelectedPlace(place);
    setBookingDateYmd(null);
    setSelectedSlot(null);
    setVisibleCalendarMonth(firstOfMonthContaining(new Date()));
    setCurrentStep("booking");
  };

  const onCreateDraft = async () => {
    if (!ensureProfileComplete()) return;
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
      Alert.alert("Invalid phone", "Please enter a valid phone number.");
      return;
    }
    if (!validationSchema.customer_email(form.customer_email)) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }

    try {
      const price = Number(selectedPlace.booking_price ?? 0);
      const phoneToSave = serializePhone(form.customer_phone);
      await createBooking.mutateAsync({
        business_card_id: selectedPlace.id,
        date_time: selectedSlot.dateTimeIso,
        cost: price,
        persons,
        customer_name: form.customer_name.trim(),
        customer_phone: phoneToSave,
        customer_email: form.customer_email.trim(),
        comment: form.comment.trim() || null,
        payment_status: price > 0 ? "pending" : "paid",
        status: "upcoming",
      });
      const createdCartItem = await createCartItem.mutateAsync({
        business_card_id: selectedPlace.id,
        date_time: selectedSlot.dateTimeIso,
        cost: price,
        persons,
        customer_name: form.customer_name.trim(),
        customer_phone: phoneToSave,
        customer_email: form.customer_email.trim(),
        comment: form.comment.trim() || null,
        is_restaurant_table: isRestaurantTable,
      });
      const accessToken = session?.access_token;
      if (accessToken && createdCartItem?.id) {
        void supabase.functions
          .invoke("n8n-wa-booking-start", {
            body: { cart_item_id: createdCartItem.id },
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
      Alert.alert(
        price > 0 ? "Draft created" : "Booking confirmed",
        price > 0
          ? "Draft booking was added to Bookings. Venue check is started in background."
          : "Your booking is now in Bookings.",
      );
      navigation.getParent()?.dispatch(
        CommonActions.navigate({
          name: "Bookings",
          params: { screen: "BookingsMain" },
        }),
      );
    } catch (error) {
      if (isAuthRequiredError(error)) {
        navigateToAuthScreen(navigation as unknown as NavigationProp<ParamListBase>);
        return;
      }
      Alert.alert("Failed", "Could not create booking draft.");
    }
  };

  if (!user) {
    return (
      <View
        style={[stylesThemed.root, { alignItems: "center", justifyContent: "center" }]}
        {...androidSwipeBackPanHandlers}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (entitlementLoading) {
    return (
      <View
        style={[stylesThemed.root, { alignItems: "center", justifyContent: "center" }]}
        {...androidSwipeBackPanHandlers}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (shouldEnforcePaywall && !hasSubscriptionAccess) {
    return (
      <View
        style={[stylesThemed.root, { alignItems: "center", justifyContent: "center" }]}
        {...androidSwipeBackPanHandlers}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <Animated.View style={[stylesThemed.root, keyboardRootStyle]} {...androidSwipeBackPanHandlers}>
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
              onPress={() => {
                setCitySearchQuery("");
                setCityPickerVisible(true);
              }}
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
              <View style={stylesThemed.dropdownTriggerLeft}>
                {selectedCategoryIconSpec ? (
                  <View style={stylesThemed.pickerRowIconWrap}>
                    <CategoryIcon spec={selectedCategoryIconSpec} size={14} color={colors.primary} />
                  </View>
                ) : null}
                <Text
                  style={[
                    stylesThemed.dropdownTriggerText,
                    !selectedCategoryId && stylesThemed.dropdownPlaceholder,
                  ]}
                  numberOfLines={2}
                >
                  {categoryDropdownLabel}
                </Text>
              </View>
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
            <Pressable
              disabled={!canContinueFromCategory}
              style={[stylesThemed.primaryBtn, !canContinueFromCategory && stylesThemed.primaryBtnDisabled]}
              onPress={() => setCurrentStep("scope")}
            >
              <Text style={stylesThemed.primaryBtnText}>Continue</Text>
            </Pressable>
            {!canContinueFromCategory && continueValidationHint ? (
              <Text style={stylesThemed.inlineValidationText}>{continueValidationHint}</Text>
            ) : null}
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
            <Pressable style={stylesThemed.primaryBtn} onPress={() => void onSearchPlaces()}>
              <Text style={stylesThemed.primaryBtnText}>{isLoading ? "Searching..." : "Search places"}</Text>
            </Pressable>
          </View>
        ) : null}

        <AIBookingTranscript messages={messages} styles={stylesThemed} />

        {(currentStep === "places" || currentStep === "booking") && hasSearched && placeOptions.length > 0 ? (
          <AIBookingSuggestedPlaces
            styles={stylesThemed}
            places={effectivePlaces}
            selectedPlace={selectedPlace}
            onSelectPlace={onSelectPlace}
          />
        ) : null}

        {currentStep === "booking" && selectedPlace ? (
          <AIBookingSlotPicker
            styles={stylesThemed}
            colors={colors}
            selectedPlace={selectedPlace}
            visibleCalendarMonth={visibleCalendarMonth}
            setVisibleCalendarMonth={setVisibleCalendarMonth}
            canGoPrevMonth={canGoPrevMonth}
            canGoNextMonth={canGoNextMonth}
            calendarCells={calendarCells}
            todayYmd={todayYmd}
            bookingDateYmd={bookingDateYmd}
            setBookingDateYmd={setBookingDateYmd}
            setSelectedSlot={setSelectedSlot}
            slotsForDate={slotsForDate}
            slotsFetching={slotsFetching}
            slotsError={slotsError}
            refetchSlots={refetchSlots}
            cartReservedSlotTimes={cartReservedSlotTimes}
            selectedSlot={selectedSlot}
          />
        ) : null}

        {currentStep === "booking" ? (
          <AIBookingCustomerForm
            styles={stylesThemed}
            colors={colors}
            form={form}
            setForm={setForm}
            summaryMessage={summaryMessage}
            selectedPlace={selectedPlace}
            onCreateDraft={onCreateDraft}
          />
        ) : null}
      </ScrollView>

      <BottomSheetPickerModal
        visible={cityPickerVisible}
        onClose={() => {
          setCitySearchQuery("");
          setCityPickerVisible(false);
        }}
        title="Choose city"
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
            {cities.map((city) => (
              <Pressable
                key={city}
                style={stylesThemed.pickerRow}
                onPress={() => {
                  setSelectedCity(city);
                  setCitySearchQuery("");
                  setCityPickerVisible(false);
                  setCurrentStep("category");
                }}
              >
                <Text style={stylesThemed.pickerRowText}>{city}</Text>
                {selectedCity === city ? <Text style={stylesThemed.pickerCheck}>Selected</Text> : null}
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

      <BottomSheetPickerModal
        visible={categoryPickerVisible}
        onClose={() => setCategoryPickerVisible(false)}
        title="Choose service or table"
      >
        {categories.map((category) => {
          const iconSpec = resolveCategoryIconSpec(category.name);
          return (
            <Pressable
              key={category.id}
              style={stylesThemed.pickerRow}
              onPress={() => {
                setSelectedCategoryId(category.id);
                setSelectedCategoryName(category.name);
                setCategoryPickerVisible(false);
              }}
            >
              <View style={stylesThemed.pickerRowLeft}>
                <View style={stylesThemed.pickerRowIconWrap}>
                  <CategoryIcon spec={iconSpec} size={14} color={colors.primary} />
                </View>
                <Text style={stylesThemed.pickerRowText} numberOfLines={1}>
                  {category.name}
                </Text>
              </View>
              {selectedCategoryId === category.id ? <Text style={stylesThemed.pickerCheck}>Selected</Text> : null}
            </Pressable>
          );
        })}
        <Pressable
          style={stylesThemed.pickerRow}
          onPress={() => {
            setSelectedCategoryId(RESTAURANT_TABLE_KEY);
            setSelectedCategoryName("Restaurant table");
            setCategoryPickerVisible(false);
          }}
        >
          <View style={stylesThemed.pickerRowLeft}>
            <View style={stylesThemed.pickerRowIconWrap}>
              <CategoryIcon
                spec={{ family: "ionicons", name: "restaurant-outline" }}
                size={14}
                color={colors.primary}
              />
            </View>
            <Text style={stylesThemed.pickerRowText} numberOfLines={1}>
              Restaurant table
            </Text>
          </View>
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
            <Pressable style={[stylesThemed.primaryBtn, { flex: 1 }]} onPress={() => setCurrentStep("scope")}>
              <Text style={stylesThemed.primaryBtnText}>Refine search</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <BookingChatDock
        visible={
          currentStep === "booking" &&
          Boolean(selectedPlace) &&
          Boolean(bookingChatContext) &&
          hasSearched &&
          placeOptions.length > 0
        }
        catalogRevision={catalogRevision}
        bookingContext={bookingChatContext}
        places={placeOptions}
        colors={colors}
        fabBottomOffset={58 + Math.max(10, insets.bottom)}
      />
    </Animated.View>
  );
}
