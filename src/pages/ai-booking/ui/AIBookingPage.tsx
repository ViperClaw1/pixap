import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
  Keyboard,
  type KeyboardEvent,
} from "react-native";
import { CommonActions, useFocusEffect, useNavigation, type NavigationProp, type ParamListBase } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BrowseFlowParamList } from "@/app/navigation/types";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { useCartItems, useCreateCartItem, useStartN8nWaBooking } from "@/entities/cart";
import { useCreateBooking } from "@/entities/booking";
import { useAvailableSlots } from "@/entities/booking";
import { usePixAI, type PixAIFlowPayload, type PixAIPlace, type PixAISlot } from "@/entities/pixai";
import { buildSearchResultsAssistantLine } from "@/entities/pixai/lib/buildSearchResultsAssistantLine";
import { useAuth } from "@/app/providers/AuthProvider";
import { useAuthSessionRedirect } from "@/features/auth-session-redirect";
import {
  shouldEnforceSubscriptionPaywall,
  useSubscriptionPaywallRedirect,
} from "@/features/subscription-paywall-redirect";
import {
  ALL_CITIES_OPTION,
  useAvailableCities,
  groupCitiesByCountry,
  filterCityGroups,
} from "@/entities/business-card";
import {
  useCategories,
  CategoryIcon,
  resolveCategoryIconSpec,
  localizeCategoryName,
  buildHomeCategoryList,
  isRestaurantCategoryName,
  isHomeCategorySelectable,
} from "@/entities/category";
import { useProfile } from "@/entities/user";
import { isProfileComplete } from "@/shared/lib/profileCompletion";
import { BottomSheetPickerModal } from "@/shared/ui/bottom-sheet-picker/BottomSheetPickerModal";
import { isInsufficientBookingCreditsError } from "@/entities/booking-credits";
import { useBookingAccess } from "@/features/booking-access";
import { useTranslation } from "react-i18next";
import { PageI18nProvider } from "@/shared/lib/i18n";
import { isAuthRequiredError, navigateToAuthScreen } from "@/shared/lib/auth/authRequired";
import {
  DEFAULT_PHONE_VALUE,
  parseStoredPhone,
  serializePhone,
  validatePhoneValue,
  type PhoneValue,
} from "@/shared/ui/phone-input";
import { useAIBookingStyles } from "./aiBookingStyles";
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
  BookingInlineAssistantChat,
  buildBookingContextFromPage,
  buildEffectivePlaces,
  useBookingChatStore,
  type BookingRecommendationView,
} from "@/features/ai-booking-chat";
import { AiBookingAssistantGate, AiBookingStepConsentPrompt, refreshAiDataConsent, useAiDataConsent } from "@/features/ai-data-consent";
import { devWarn } from "@/shared/lib/devLog";
import { appAlert } from "@/shared/ui/app-popup";
import {
  AI_BOOKING_COMPOSER_KEYBOARD_MARGIN,
  AI_BOOKING_DEFAULT_COMMENT_INPUT_HEIGHT,
  AI_BOOKING_DEFAULT_PERSONS,
} from "../model/constants";

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
type Nav = NativeStackNavigationProp<BrowseFlowParamList, "AIBooking">;

const validationSchema = {
  persons: (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 1;
  },
  customer_name: (value: string) => value.trim().length > 0,
  customer_phone: (value: PhoneValue) => validatePhoneValue(value) === null,
  customer_email: (value: string) => EMAIL_REGEX.test(value.trim()),
};

function AIBookingPageContent() {
  const insets = useSafeAreaInsets();
  const bookingComposerScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bookingComposerFocusedRef = useRef(false);
  const bookingScrollRef = useRef<ScrollView>(null);
  const bookingScrollYRef = useRef(0);
  const bookingScrollLayoutRef = useRef({ viewH: 0, contentH: 0 });
  const bookingComposerInputRef = useRef<TextInput>(null);
  const keyboardTopScreenRef = useRef<number | null>(null);

  const scrollBookingContentToUncoverComposer = useCallback(() => {
    if (!bookingComposerFocusedRef.current) return;
    const keyboardTop = keyboardTopScreenRef.current;
    if (keyboardTop == null) return;
    const input = bookingComposerInputRef.current;
    if (!input) return;
    const margin = AI_BOOKING_COMPOSER_KEYBOARD_MARGIN;
    input.measureInWindow((_x, y, _w, h) => {
      const bottom = y + h;
      const overlap = bottom - (keyboardTop - margin);
      if (overlap <= 0) return;
      const { viewH, contentH } = bookingScrollLayoutRef.current;
      const maxY = Math.max(0, contentH - viewH);
      const nextY = Math.min(maxY, bookingScrollYRef.current + overlap);
      if (nextY <= bookingScrollYRef.current + 0.5) return;
      bookingScrollRef.current?.scrollTo({ y: nextY, animated: true });
    });
  }, []);

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (e: KeyboardEvent) => {
      const { height, screenY } = e.endCoordinates;
      if (!height || height < 1) {
        keyboardTopScreenRef.current = null;
        return;
      }
      keyboardTopScreenRef.current = screenY;
      scrollBookingContentToUncoverComposer();
    };
    const onHide = () => {
      keyboardTopScreenRef.current = null;
    };
    const subShow = Keyboard.addListener(showEvt, onShow);
    const subHide = Keyboard.addListener(hideEvt, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [scrollBookingContentToUncoverComposer]);

  const onBookingComposerInputFocus = useCallback(() => {
    bookingComposerFocusedRef.current = true;
    const prev = bookingComposerScrollTimeoutRef.current;
    if (prev != null) clearTimeout(prev);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollBookingContentToUncoverComposer();
      });
    });
    bookingComposerScrollTimeoutRef.current = setTimeout(() => {
      bookingComposerScrollTimeoutRef.current = null;
      scrollBookingContentToUncoverComposer();
    }, 280);
  }, [scrollBookingContentToUncoverComposer]);

  const onBookingComposerInputBlur = useCallback(() => {
    bookingComposerFocusedRef.current = false;
    const pending = bookingComposerScrollTimeoutRef.current;
    if (pending != null) {
      clearTimeout(pending);
      bookingComposerScrollTimeoutRef.current = null;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      useBookingChatStore.getState().resetTransientSendState();
    }, []),
  );

  const { colors } = useAppTheme();
  const { user, session, loading: authLoading } = useAuth();

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      void refreshAiDataConsent(user.id);
    }, [user?.id]),
  );

  const { t } = useTranslation();
  const restaurantTableLabel = t("bookingCommon.restaurantTable");
  const nearMeLabel = t("bookingCommon.nearMe5Miles");
  const allPlacesInCityLabel = t("bookingCommon.allPlacesInCity");
  const allPlacesInMyCityLabel = t("bookingCommon.allPlacesInMyCity");
  const notSelectedLabel = t("bookingCommon.notSelected");
  const serviceLabel = t("bookingCommon.service");
  const {
    canAccessAIBooking,
    isLoading: accessLoading,
    canUseBookingCredits,
  } = useBookingAccess();
  const shouldEnforcePaywall = shouldEnforceSubscriptionPaywall();
  const navigation = useNavigation<Nav>();
  const androidSwipeBackPanHandlers = useAndroidFullSwipeBackPanHandlers(navigation);
  useAuthSessionRedirect({
    authLoading: authLoading,
    hasUser: Boolean(user),
    navigation,
  });
  useSubscriptionPaywallRedirect({
    accessLoading,
    shouldEnforcePaywall,
    hasAccess: canAccessAIBooking,
    paywallReason: !canUseBookingCredits ? "no_credits" : "upgrade",
    navigation: navigation as {
      replace: (name: "SubscriptionPaywall", params?: { reason?: "no_credits" | "upgrade" }) => void;
    },
  });
  const { messages, runFlow, isLoading, resetFlowSearchTranscript } = usePixAI();
  const { data: profile } = useProfile();
  const { needsPrompt: needsAiConsentPrompt, status: aiConsentStatus } = useAiDataConsent();
  const { data: availableCities = [ALL_CITIES_OPTION] } = useAvailableCities();
  const { data: categories = [] } = useCategories();
  const bookingCategoryOptions = useMemo(() => buildHomeCategoryList(categories), [categories]);
  const createCartItem = useCreateCartItem();
  const createBooking = useCreateBooking();
  const startN8nWaBooking = useStartN8nWaBooking();
  const { data: cartItems = [] } = useCartItems();
  const [currentStep, setCurrentStep] = useState<FlowStep>("city");
  const [selectedCity, setSelectedCity] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>("");
  const [commentInputHeight, setCommentInputHeight] = useState(AI_BOOKING_DEFAULT_COMMENT_INPUT_HEIGHT);
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
    persons: AI_BOOKING_DEFAULT_PERSONS,
    customer_name: "",
    customer_phone: DEFAULT_PHONE_VALUE,
    customer_email: "",
    comment: "",
  });
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [confirmingBooking, setConfirmingBooking] = useState(false);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);

  const persistedCatalogRevision = useBookingChatStore((s) => s.catalogRevision);
  const persistedTabsCount = useBookingChatStore((s) => s.tabs.length);
  const lastSearchSnapshot = useBookingChatStore((s) => s.lastSearchSnapshot);

  useEffect(() => {
    if (persistedCatalogRevision <= 0) return;
    setCatalogRevision((prev) => Math.max(prev, persistedCatalogRevision));
  }, [persistedCatalogRevision]);

  useEffect(() => {
    if (persistedTabsCount === 0 && !lastSearchSnapshot) return;
    if (aiConsentStatus === "loading" || needsAiConsentPrompt) return;
    setHasSearched(true);
    setCurrentStep((prev) =>
      prev === "city" || prev === "category" || prev === "scope" ? "places" : prev,
    );
  }, [aiConsentStatus, needsAiConsentPrompt, persistedTabsCount, lastSearchSnapshot]);

  useEffect(() => {
    const snap = lastSearchSnapshot;
    if (!snap) return;
    setSelectedCity((prev) => (prev.trim() ? prev : snap.city));
    if (snap.isRestaurantTable) {
      setSelectedCategoryId((prev) => (prev.trim() ? prev : RESTAURANT_TABLE_KEY));
      setSelectedCategoryName((prev) => (prev.trim() ? prev : restaurantTableLabel));
    } else {
      setSelectedCategoryId((prev) => (prev.trim() ? prev : snap.categoryId));
      setSelectedCategoryName((prev) => (prev.trim() ? prev : snap.categoryName));
    }
    setScope(snap.scope);
    setRequestComment((prev) => (prev.trim() ? prev : snap.requestComment));
  }, [lastSearchSnapshot, restaurantTableLabel]);

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
    Alert.alert(t("bookingCommon.profileIncompleteTitle"), t("bookingCommon.profileIncompleteMessage"));
    redirectToEditProfile();
    return false;
  };

  const styles = useAIBookingStyles({ top: insets.top, bottom: insets.bottom });

  useEffect(() => {
    const city = profile?.city?.trim();
    if (!city) return;
    if (aiConsentStatus === "loading" || needsAiConsentPrompt) return;
    setSelectedCity(city);
    setCurrentStep((prev) => (prev === "city" ? "category" : prev));
  }, [profile?.city, aiConsentStatus, needsAiConsentPrompt]);

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

  const placeOptions = latestToolResult?.places ?? lastSearchSnapshot?.catalogPlaces ?? [];

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
    Alert.alert(t("aiBooking.listUpdatedTitle"), t("aiBooking.listUpdatedMessage"));
    setSelectedPlace(null);
    setBookingDateYmd(null);
    setSelectedSlot(null);
    setCurrentStep("places");
  }, [effectivePlaces, placeOptions.length, selectedPlace, t]);

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

  const bookingChatContext = useMemo(() => {
    if (!selectedCity?.trim() || selectedCity === ALL_CITIES_OPTION) return null;
    return buildBookingContextFromPage({
      city: selectedCity,
      categoryLabel: isRestaurantTable
        ? restaurantTableLabel
        : selectedCategoryName
          ? localizeCategoryName(selectedCategoryName, t)
          : serviceLabel,
      scopeLabel: scope === "nearby" ? nearMeLabel : allPlacesInCityLabel,
      requestComment: requestComment.trim() || undefined,
      selectedPlace,
      bookingDateYmd,
      selectedSlot: selectedSlot ? { label: selectedSlot.label } : null,
    });
  }, [
    selectedCity,
    isRestaurantTable,
    selectedCategoryName,
    scope,
    requestComment,
    selectedPlace,
    bookingDateYmd,
    selectedSlot,
    restaurantTableLabel,
    serviceLabel,
    nearMeLabel,
    allPlacesInCityLabel,
    t,
  ]);

  const selectedCategoryRow = categories.find((c) => c.id === selectedCategoryId);
  const categoryDropdownLabel = isRestaurantTable
    ? restaurantTableLabel
    : selectedCategoryRow
      ? localizeCategoryName(selectedCategoryRow.name, t)
      : selectedCategoryName
        ? localizeCategoryName(selectedCategoryName, t)
        : t("bookingCommon.selectServiceOrTable");
  const selectedCategoryIconSpec = isRestaurantTable
    ? ({ family: "ionicons", name: "restaurant-outline" } as const)
    : selectedCategoryRow
      ? resolveCategoryIconSpec(selectedCategoryRow.name)
      : null;

  const summaryMessage = [
    t("aiBooking.summaryCity", { value: selectedCity || notSelectedLabel }),
    t("aiBooking.summaryRequest", {
      value: isRestaurantTable
        ? restaurantTableLabel
        : selectedCategoryName
          ? localizeCategoryName(selectedCategoryName, t)
          : notSelectedLabel,
    }),
    t("aiBooking.summaryScope", { value: scope === "nearby" ? nearMeLabel : allPlacesInCityLabel }),
    selectedPlace ? t("aiBooking.summaryPlace", { name: selectedPlace.name }) : null,
    requestComment.trim() ? t("aiBooking.summaryComment", { text: requestComment.trim() }) : null,
  ]
    .filter(Boolean)
    .join("\n");
  const canContinueFromCategory = selectedCity !== "" && selectedCity !== ALL_CITIES_OPTION && selectedCategoryId.trim().length > 0;
  const continueValidationHint =
    selectedCity === "" || selectedCity === ALL_CITIES_OPTION
      ? t("aiBooking.selectCityHint")
      : selectedCategoryId.trim().length === 0
        ? t("aiBooking.selectCategoryHint")
        : null;

  const onRequestNearbyPermission = async () => {
    const existing = await Location.getForegroundPermissionsAsync();
    const permission =
      existing.status === "granted"
        ? existing
        : await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      Alert.alert(t("aiBooking.locationRequiredTitle"), t("aiBooking.locationRequiredMessage"));
      return null;
    }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    setLocationCoords(coords);
    return coords;
  };

  const onSearchPlaces = async () => {
    if (isSearchingPlaces || isLoading) return;
    if (!ensureProfileComplete()) return;
    if (!selectedCity || selectedCity === ALL_CITIES_OPTION) {
      Alert.alert(t("bookingCommon.chooseCity"), t("bookingCommon.chooseCityMessage"));
      return;
    }
    if (!selectedCategoryId) {
      Alert.alert(t("aiBooking.chooseRequestTitle"), t("aiBooking.chooseRequestMessage"));
      return;
    }

    setIsSearchingPlaces(true);
    resetFlowSearchTranscript();
    setSelectedPlace(null);
    setSelectedSlot(null);
    setBookingDateYmd(null);

    let coords = locationCoords;
    if (scope === "nearby" && !coords) {
      coords = await onRequestNearbyPermission();
      if (!coords) {
        setIsSearchingPlaces(false);
        return;
      }
    }

    const payload: PixAIFlowPayload = {
      city: selectedCity.trim(),
      categoryId: isRestaurantTable ? undefined : selectedCategoryId.trim(),
      categoryName: isRestaurantTable ? restaurantTableLabel : selectedCategoryName,
      isRestaurantTable,
      comment: requestComment.trim() || undefined,
      mode: scope,
      radiusMiles: DEFAULT_RADIUS_MILES,
      location: scope === "nearby" ? coords ?? undefined : undefined,
      limit: 8,
    };

    try {
      const result = await runFlow(payload);
      const placeCount = result.places?.length ?? 0;
      const scopeText = scope === "nearby" ? nearMeLabel : allPlacesInMyCityLabel;
      const requestType = isRestaurantTable
        ? restaurantTableLabel
        : selectedCategoryName
          ? localizeCategoryName(selectedCategoryName, t)
          : t("aiBooking.placesFallback");
      const resultsLine = buildSearchResultsAssistantLine({ count: placeCount, requestType, scopeText });

      setHasSearched(true);
      setCurrentStep("places");
      let nextRev = 0;
      setCatalogRevision((prev) => {
        nextRev = prev + 1;
        return nextRev;
      });
      const catalogPlaces = result.places ?? [];
      setTimeout(() => {
        useBookingChatStore.getState().bumpCatalogRevisionWithOpening(nextRev, resultsLine, {
          city: selectedCity.trim(),
          categoryId: isRestaurantTable ? RESTAURANT_TABLE_KEY : selectedCategoryId.trim(),
          categoryName: isRestaurantTable ? restaurantTableLabel : selectedCategoryName || "",
          isRestaurantTable,
          scope,
          requestComment: requestComment.trim(),
          catalogPlaces,
        });
      }, 0);
    } catch (error) {
      if (isAuthRequiredError(error)) {
        navigateToAuthScreen(navigation);
        return;
      }
      Alert.alert(t("bookingCommon.failed"), error instanceof Error ? error.message : t("aiBooking.searchFailed"));
    } finally {
      setIsSearchingPlaces(false);
    }
  };

  const searchPlacesBusy = isSearchingPlaces || isLoading;

  const onSelectPlace = (place: PixAIPlace) => {
    setSelectedPlace(place);
    setBookingDateYmd(null);
    setSelectedSlot(null);
    setVisibleCalendarMonth(firstOfMonthContaining(new Date()));
    setCurrentStep("booking");
  };

  const onCreateDraft = async () => {
    if (confirmingBooking) return;
    if (!canUseBookingCredits) {
      Alert.alert(t("bookingCredits.noCreditsTitle"), t("bookingCredits.noCreditsMessage"));
      return;
    }
    if (!ensureProfileComplete()) return;
    if (!selectedPlace || !selectedSlot) {
      Alert.alert(t("aiBooking.missingSelectionTitle"), t("aiBooking.missingSelectionMessage"));
      return;
    }
    const persons = Number(form.persons);
    if (!validationSchema.persons(form.persons)) {
      Alert.alert(t("aiBooking.invalidPersonsTitle"), t("aiBooking.invalidPersonsMessage"));
      return;
    }
    if (!validationSchema.customer_name(form.customer_name)) {
      Alert.alert(t("aiBooking.missingDetailsTitle"), t("bookingCommon.nameRequired"));
      return;
    }
    if (!validationSchema.customer_phone(form.customer_phone)) {
      Alert.alert(t("aiBooking.invalidPhoneTitle"), t("bookingCommon.invalidPhone"));
      return;
    }
    if (!validationSchema.customer_email(form.customer_email)) {
      Alert.alert(t("aiBooking.invalidEmailTitle"), t("bookingCommon.invalidEmail"));
      return;
    }

    setConfirmingBooking(true);
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
        payment_status: "pending",
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
        void startN8nWaBooking.mutateAsync({ cartItemId: createdCartItem.id, accessToken }).catch((error) => {
          if (__DEV__) {
            devWarn("[n8n-wa-booking-start] invoke failed", error instanceof Error ? error.message : error);
          }
        });
      }
      appAlert(
        t("bookingCommon.draftCreatedTitle"),
        t("bookingCommon.draftCreatedMessage"),
        undefined,
        "success",
      );
      navigation.getParent()?.dispatch(
        CommonActions.navigate({
          name: "Bookings",
          params: { screen: "BookingsMain" },
        }),
      );
    } catch (error) {
      if (isAuthRequiredError(error)) {
        navigateToAuthScreen(navigation);
        return;
      }
      if (isInsufficientBookingCreditsError(error)) {
        Alert.alert(t("bookingCredits.noCreditsTitle"), t("bookingCredits.noCreditsMessage"));
        return;
      }
      Alert.alert(t("bookingCommon.failed"), t("bookingCommon.couldNotCreateDraft"));
    } finally {
      setConfirmingBooking(false);
    }
  };

  if (!user) {
    return (
      <View
        style={[styles.root, { alignItems: "center", justifyContent: "center" }]}
        {...androidSwipeBackPanHandlers}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (accessLoading) {
    return (
      <View
        style={[styles.root, { alignItems: "center", justifyContent: "center" }]}
        {...androidSwipeBackPanHandlers}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (shouldEnforcePaywall && !canAccessAIBooking) {
    return null;
  }

  return (
    <View style={styles.root} {...androidSwipeBackPanHandlers}>
      <AiBookingStepConsentPrompt />
      <ScrollView
        ref={bookingScrollRef}
        style={styles.root}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="always"
        nestedScrollEnabled
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        scrollEventThrottle={16}
        onScroll={(e) => {
          bookingScrollYRef.current = e.nativeEvent.contentOffset.y;
        }}
        onLayout={(e) => {
          bookingScrollLayoutRef.current = {
            ...bookingScrollLayoutRef.current,
            viewH: e.nativeEvent.layout.height,
          };
        }}
        onContentSizeChange={(_w, h) => {
          bookingScrollLayoutRef.current = {
            ...bookingScrollLayoutRef.current,
            contentH: h,
          };
        }}
      >
        <View style={styles.semanticSection}>
          <View style={styles.topRow}>
            <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={18} color={colors.text} />
            </Pressable>
            <Text style={styles.title}>{t("aiBooking.title")}</Text>
          </View>
          <Text style={styles.subtitle}>{t("aiBooking.subtitle")}</Text>
        </View>

        {currentStep === "city" ? (
          <View style={styles.semanticSection}>
            <Text style={styles.stepTitle}>{t("aiBooking.step1Title")}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("bookingCommon.chooseCity")}
              style={styles.dropdownTrigger}
              onPress={() => {
                setCitySearchQuery("");
                setCityPickerVisible(true);
              }}
            >
              <Text
                style={[styles.dropdownTriggerText, !selectedCity && styles.dropdownPlaceholder]}
                numberOfLines={1}
              >
                {selectedCity || t("bookingCommon.selectCity")}
              </Text>
              <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : null}

        {currentStep === "category" ? (
          <View style={styles.semanticSection}>
            <Text style={styles.stepTitle}>{t("aiBooking.step2Title")}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("bookingCommon.chooseServiceOrTable")}
              style={styles.dropdownTrigger}
              onPress={() => setCategoryPickerVisible(true)}
            >
              <View style={styles.dropdownTriggerLeft}>
                {selectedCategoryIconSpec ? (
                  <View style={styles.pickerRowIconWrap}>
                    <CategoryIcon spec={selectedCategoryIconSpec} size={14} color={colors.primary} />
                  </View>
                ) : null}
                <Text
                  style={[
                    styles.dropdownTriggerText,
                    !selectedCategoryId && styles.dropdownPlaceholder,
                  ]}
                  numberOfLines={2}
                >
                  {categoryDropdownLabel}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
            </Pressable>
            <TextInput
              style={[styles.field, styles.fieldOnCard, styles.commentField, { height: commentInputHeight }]}
              multiline
              value={requestComment}
              onContentSizeChange={(event) => setCommentInputHeight(Math.min(180, Math.max(88, event.nativeEvent.contentSize.height + 10)))}
              onChangeText={setRequestComment}
              placeholder={t("aiBooking.commentPlaceholder")}
              placeholderTextColor={colors.textMuted}
            />
            <Pressable
              disabled={!canContinueFromCategory}
              style={[styles.primaryBtn, !canContinueFromCategory && styles.primaryBtnDisabled]}
              onPress={() => setCurrentStep("scope")}
            >
              <Text style={styles.primaryBtnText}>{t("bookingCommon.continue")}</Text>
            </Pressable>
            {!canContinueFromCategory && continueValidationHint ? (
              <Text style={styles.inlineValidationText}>{continueValidationHint}</Text>
            ) : null}
          </View>
        ) : null}

        {currentStep === "scope" ? (
          <View style={styles.semanticSection}>
            <Text style={styles.stepTitle}>{t("aiBooking.step3Title")}</Text>
            <Pressable
              style={[styles.optionChip, scope === "nearby" && styles.optionChipSelected]}
              onPress={() => setScope("nearby")}
            >
              <Text style={styles.optionChipText}>{nearMeLabel}</Text>
            </Pressable>
            <Pressable
              style={[styles.optionChip, scope === "city" && styles.optionChipSelected]}
              onPress={() => setScope("city")}
            >
              <Text style={styles.optionChipText}>{allPlacesInMyCityLabel}</Text>
            </Pressable>
            <Text style={styles.helperText}>{t("aiBooking.nearbyHelper")}</Text>
            <Pressable
              disabled={searchPlacesBusy}
              style={[styles.primaryBtn, searchPlacesBusy && styles.primaryBtnDisabled]}
              onPress={() => void onSearchPlaces()}
            >
              {searchPlacesBusy ? (
                <View style={styles.primaryBtnBusyRow}>
                  <ActivityIndicator color={colors.onPrimary} size="small" />
                  <Text style={styles.primaryBtnText}>{t("aiBooking.searching")}</Text>
                </View>
              ) : (
                <Text style={styles.primaryBtnText}>{t("aiBooking.searchPlaces")}</Text>
              )}
            </Pressable>
          </View>
        ) : null}

        <AIBookingTranscript messages={messages} styles={styles} />

        {(currentStep === "places" || currentStep === "booking") &&
        (hasSearched || persistedTabsCount > 0) &&
        (placeOptions.length > 0 || persistedTabsCount > 0) &&
        bookingChatContext ? (
          <View style={styles.semanticSection}>
            <Text style={styles.stepTitle}>{t("aiBooking.step4AssistantTitle")}</Text>
            <AiBookingAssistantGate>
              <BookingInlineAssistantChat
                catalogRevision={catalogRevision}
                bookingContext={bookingChatContext}
                places={placeOptions}
                composerInputRef={bookingComposerInputRef}
                onComposerInputFocus={onBookingComposerInputFocus}
                onComposerInputBlur={onBookingComposerInputBlur}
              />
            </AiBookingAssistantGate>
          </View>
        ) : null}

        {(currentStep === "places" || currentStep === "booking") &&
        (hasSearched || persistedTabsCount > 0) &&
        placeOptions.length > 0 ? (
          <AIBookingSuggestedPlaces
            styles={styles}
            places={effectivePlaces}
            selectedPlace={selectedPlace}
            onSelectPlace={onSelectPlace}
          />
        ) : null}

        {currentStep === "booking" && selectedPlace ? (
          <AIBookingSlotPicker
            styles={styles}
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
            styles={styles}
            form={form}
            setForm={setForm}
            summaryMessage={summaryMessage}
            selectedPlace={selectedPlace}
            onCreateDraft={onCreateDraft}
            submitting={confirmingBooking}
          />
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.row}>
          {currentStep !== "city" ? (
            <Pressable
              style={[styles.footerBtn, { flex: 1 }]}
              onPress={() =>
                setCurrentStep((step) =>
                  step === "booking" ? "places" : step === "places" ? "scope" : step === "scope" ? "category" : "city",
                )
              }
            >
              <Text
                style={styles.footerBtnText}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {t("bookingCommon.backStep")}
              </Text>
            </Pressable>
          ) : null}
          {currentStep === "places" ? (
            <Pressable style={[styles.footerBtn, styles.footerPrimaryBtn, { flex: 1 }]} onPress={() => setCurrentStep("scope")}>
              <Text
                style={styles.footerPrimaryBtnText}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {t("aiBooking.refineSearch")}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <BottomSheetPickerModal
        visible={cityPickerVisible}
        onClose={() => {
          setCitySearchQuery("");
          setCityPickerVisible(false);
        }}
        title={t("bookingCommon.chooseCity")}
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
            {cities.map((city) => (
              <Pressable
                key={city}
                style={styles.pickerRow}
                onPress={() => {
                  setSelectedCity(city);
                  setCitySearchQuery("");
                  setCityPickerVisible(false);
                  setCurrentStep("category");
                }}
              >
                <Text style={styles.pickerRowText}>{city}</Text>
                {selectedCity === city ? <Text style={styles.pickerCheck}>{t("bookingCommon.selected")}</Text> : null}
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

      <BottomSheetPickerModal
        visible={categoryPickerVisible}
        onClose={() => setCategoryPickerVisible(false)}
        title={t("bookingCommon.chooseServiceOrTable")}
      >
        {bookingCategoryOptions.map((category) => {
          const iconSpec = resolveCategoryIconSpec(category.name);
          const label = localizeCategoryName(category.name, t);
          const isSelected = isRestaurantCategoryName(category.name)
            ? isRestaurantTable
            : selectedCategoryId === category.id;
          const isSelectable = !category.isComingSoon && (isRestaurantCategoryName(category.name) || isHomeCategorySelectable(category));

          return (
            <Pressable
              key={category.id}
              style={[styles.pickerRow, category.isComingSoon && styles.pickerRowComingSoon]}
              disabled={!isSelectable}
              accessibilityRole="button"
              accessibilityState={{ disabled: !isSelectable, selected: isSelected }}
              accessibilityLabel={
                category.isComingSoon ? `${label}, ${t("home.categoryComingSoon")}` : label
              }
              onPress={() => {
                if (!isSelectable) return;
                if (isRestaurantCategoryName(category.name)) {
                  setSelectedCategoryId(RESTAURANT_TABLE_KEY);
                  setSelectedCategoryName(restaurantTableLabel);
                } else {
                  setSelectedCategoryId(category.id);
                  setSelectedCategoryName(category.name);
                }
                setCategoryPickerVisible(false);
              }}
            >
              <View style={styles.pickerRowLeft}>
                <View style={styles.pickerRowIconWrap}>
                  <CategoryIcon spec={iconSpec} size={14} color={colors.primary} />
                </View>
                <Text style={styles.pickerRowText} numberOfLines={1}>
                  {label}
                </Text>
              </View>
              <View style={styles.pickerRowRight}>
                {category.isComingSoon ? (
                  <View style={styles.categoryComingSoonBadge}>
                    <Text style={styles.categoryComingSoonBadgeText}>{t("home.categoryComingSoon")}</Text>
                  </View>
                ) : null}
                {isSelected ? <Text style={styles.pickerCheck}>{t("bookingCommon.selected")}</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </BottomSheetPickerModal>
    </View>
  );
}

export default function AIBookingPage() {
  return (
    <PageI18nProvider>
      <AIBookingPageContent />
    </PageI18nProvider>
  );
}
