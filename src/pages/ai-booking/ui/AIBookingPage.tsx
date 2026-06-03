import { AppPressable } from "@/shared/ui/app-pressable";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Alert,
  ActivityIndicator,
  BackHandler,
  Platform,
  ScrollView,
  Keyboard,
  Modal,
  type KeyboardEvent
} from "react-native";
import { CommonActions, useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BrowseFlowParamList } from "@/app/navigation/types";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { useCartItems, useCreateCartItem, useStartN8nWaBooking } from "@/entities/cart";
import { useCreateBooking } from "@/entities/booking";
import { useAvailableSlots } from "@/entities/booking";
import {
  usePixAI,
  type PixAIFlowPayload,
  type PixAIPlace,
  type PixAISlot,
} from "@/entities/pixai";
import { buildSearchResultsLineFromFlow } from "@/entities/pixai/lib/buildSearchResultsAssistantLine";
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
import { OnboardingStepTransition } from "@/pages/preference-onboarding/ui/OnboardingStepTransition";
import { useShallow } from "zustand/react/shallow";
import {
  BookingInlineAssistantChat,
  buildBookingContextFromPage,
  buildEffectivePlaces,
  BookingAssistantChatSkeleton,
  useBookingChatStore,
  type BookingRecommendationView,
  type BookingSearchSnapshot,
} from "@/features/ai-booking-chat";
import { collectOpeningTypewriterKeysFromMessages } from "@/features/ai-booking-chat/lib/collectOpeningTypewriterKeys";
import { clearBookingOpeningTypewriterKeys } from "@/features/ai-booking-chat/lib/bookingOpeningTypewriterRegistry";
import {
  BookingRequestHistoryDrawer,
  buildHistoryItemFromTab,
} from "@/features/ai-booking-request-history";
import type { BookingOnboardingPhase } from "@/features/ai-booking-onboarding";
import {
  parseOnboardingAssistantStep,
  hasOnboardingPrefilledCity,
  onboardingAssistantMessageId,
  seedOnboardingCategoryQuestion,
  seedOnboardingGreetingMessage,
  seedOnboardingScopeQuestion,
  seedOnboardingSearchResultsMessage,
  syncOnboardingGreetingMessage,
} from "@/features/ai-booking-onboarding";
import { AiBookingAssistantGate, AiBookingStepConsentPrompt, refreshAiDataConsent, useAiDataConsent } from "@/features/ai-data-consent";
import { devWarn } from "@/shared/lib/devLog";
import { AppPopupModal, appAlert } from "@/shared/ui/app-popup";
import {
  AI_BOOKING_COMPOSER_KEYBOARD_MARGIN,
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

type FlowStep = "assistant" | "booking";
type Nav = NativeStackNavigationProp<BrowseFlowParamList, "AIBooking">;
type AIBookingRoute = RouteProp<BrowseFlowParamList, "AIBooking">;
type AIBookingScrollState = {
  assistantY: number;
  bookingY: number;
  step: FlowStep;
};

const aiBookingScrollStateByRouteKey = new Map<string, AIBookingScrollState>();

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
  const route = useRoute<AIBookingRoute>();
  const initialScrollState = aiBookingScrollStateByRouteKey.get(route.key);
  const insets = useSafeAreaInsets();
  const bookingComposerScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bookingComposerFocusedRef = useRef(false);
  const bookingScrollRef = useRef<ScrollView>(null);
  const androidScreenSwipeEnabledRef = useRef(true);
  const initialStepRef = useRef<FlowStep>(initialScrollState?.step ?? "assistant");
  const currentStepRef = useRef<FlowStep>(initialStepRef.current);
  const bookingScrollYRef = useRef(initialScrollState?.bookingY ?? 0);
  /** Scroll offset on step 1 saved when opening booking — restored on return. */
  const assistantScrollYRef = useRef(initialScrollState?.assistantY ?? 0);
  const initialScrollOffsetRef = useRef({
    x: 0,
    y:
      initialStepRef.current === "assistant"
        ? (initialScrollState?.assistantY ?? 0)
        : (initialScrollState?.bookingY ?? 0),
  });
  const bookingScrollLayoutRef = useRef({ viewH: 0, contentH: 0 });
  const bookingComposerInputRef = useRef<TextInput>(null);
  const keyboardTopScreenRef = useRef<number | null>(null);
  const greetingBootstrappedRef = useRef(new Set<string>());
  const openingReplayGuardRef = useRef<string | null>(null);
  const [openingTypewriterEpoch, setOpeningTypewriterEpoch] = useState(0);

  const persistScrollState = useCallback(() => {
    const step = currentStepRef.current;
    const visibleY = bookingScrollYRef.current;
    aiBookingScrollStateByRouteKey.set(route.key, {
      assistantY: step === "assistant" ? visibleY : assistantScrollYRef.current,
      bookingY: step === "booking" ? visibleY : 0,
      step,
    });
  }, [route.key]);

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
  const { runFlow, isLoading, resetFlowSearchTranscript } = usePixAI();
  const { data: profile, isPending: profilePending } = useProfile();
  const { needsPrompt: needsAiConsentPrompt, status: aiConsentStatus } = useAiDataConsent();

  const replayOnboardingOpeningTypewriter = useCallback(() => {
    const store = useBookingChatStore.getState();
    const tabId = store.activeTabId;
    if (!tabId) return;
    const tab = store.tabs.find((t) => t.id === tabId);
    if (!tab || tab.searchSnapshot) return;
    if (tab.onboardingPhase === "gemini" || tab.onboardingPhase === "search_results") return;

    const keys = collectOpeningTypewriterKeysFromMessages(tab.messages);
    if (keys.length === 0) return;

    const replayGuardKey = `${tabId}:${keys.join("|")}`;
    if (openingReplayGuardRef.current === replayGuardKey) return;
    openingReplayGuardRef.current = replayGuardKey;

    clearBookingOpeningTypewriterKeys(keys);
    if (
      tab.onboardingPhase === "greeting" ||
      tab.onboardingPhase === "await_city" ||
      tab.onboardingPhase === "await_category" ||
      tab.onboardingPhase === "await_scope"
    ) {
      store.setTabOnboardingPhase(tabId, "assistant_typing");
    }
    setOpeningTypewriterEpoch((epoch) => epoch + 1);
  }, []);

  useFocusEffect(
    useCallback(() => {
      openingReplayGuardRef.current = null;
      if (aiConsentStatus === "loading" || needsAiConsentPrompt) return;
      replayOnboardingOpeningTypewriter();
      return undefined;
    }, [aiConsentStatus, needsAiConsentPrompt, replayOnboardingOpeningTypewriter]),
  );

  const { data: availableCities = [ALL_CITIES_OPTION] } = useAvailableCities();
  const { data: categories = [] } = useCategories();
  const bookingCategoryOptions = useMemo(() => buildHomeCategoryList(categories), [categories]);
  const createCartItem = useCreateCartItem();
  const createBooking = useCreateBooking();
  const startN8nWaBooking = useStartN8nWaBooking();
  const { data: cartItems = [] } = useCartItems();
  const [currentStep, setCurrentStep] = useState<FlowStep>(initialStepRef.current);
  const [stepDirection, setStepDirection] = useState<1 | -1>(1);
  const [selectedCity, setSelectedCity] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>("");
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
  const [historyOpen, setHistoryOpen] = useState(false);
  const [resetChatConfirmVisible, setResetChatConfirmVisible] = useState(false);
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
  const [bookingPlaceId, setBookingPlaceId] = useState<string | null>(null);

  const goToAssistantStep = useCallback(() => {
    setStepDirection(-1);
    setCurrentStep("assistant");
  }, []);

  const goToBookingStep = useCallback(() => {
    assistantScrollYRef.current = bookingScrollYRef.current;
    setStepDirection(1);
    setCurrentStep("booking");
  }, []);

  useLayoutEffect(() => {
    currentStepRef.current = currentStep;
    if (currentStep !== "booking") return;
    setBookingPlaceId(null);
    bookingScrollRef.current?.scrollTo({ y: 0, animated: false });
    bookingScrollYRef.current = 0;
  }, [currentStep]);

  useLayoutEffect(() => {
    currentStepRef.current = currentStep;
    if (currentStep !== "assistant") return;
    const targetY = assistantScrollYRef.current;
    if (targetY <= 0) return;

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        bookingScrollRef.current?.scrollTo({ y: targetY, animated: false });
        bookingScrollYRef.current = targetY;
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [currentStep]);

  useFocusEffect(
    useCallback(() => {
      const cached = aiBookingScrollStateByRouteKey.get(route.key);
      if (cached) {
        assistantScrollYRef.current = cached.assistantY;
        if (currentStepRef.current === "assistant") {
          bookingScrollYRef.current = cached.assistantY;
          bookingScrollRef.current?.scrollTo({ y: cached.assistantY, animated: false });
        }
      }

      return () => {
        persistScrollState();
      };
    }, [persistScrollState, route.key]),
  );

  useEffect(() => {
    return () => {
      persistScrollState();
    };
  }, [persistScrollState]);

  useEffect(() => {
    androidScreenSwipeEnabledRef.current = currentStep === "assistant";
  }, [currentStep]);

  const onHeaderBackPress = useCallback(() => {
    if (currentStep === "booking") {
      goToAssistantStep();
      return;
    }
    navigation.goBack();
  }, [currentStep, goToAssistantStep, navigation]);

  const androidSwipeBackPanHandlers = useAndroidFullSwipeBackPanHandlers(navigation, {
    enabledRef: androidScreenSwipeEnabledRef,
  });

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    navigation.setOptions({
      gestureEnabled: currentStep === "assistant",
      fullScreenGestureEnabled: currentStep === "assistant",
    });
  }, [currentStep, navigation]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (currentStep === "booking") {
        goToAssistantStep();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [currentStep, goToAssistantStep]);

  const persistedCatalogRevision = useBookingChatStore((s) => s.catalogRevision);
  const persistedTabsCount = useBookingChatStore((s) => s.tabs.length);
  const lastSearchSnapshot = useBookingChatStore((s) => s.lastSearchSnapshot);
  const chatTabs = useBookingChatStore(useShallow((s) => s.tabs));
  const activeTabId = useBookingChatStore((s) => s.activeTabId);
  const activeTab = useMemo(
    () => chatTabs.find((tab) => tab.id === activeTabId) ?? null,
    [chatTabs, activeTabId],
  );
  const onboardingPhase: BookingOnboardingPhase = activeTab?.onboardingPhase ?? "greeting";
  const activeTabSnapshot = activeTab?.searchSnapshot ?? null;

  useEffect(() => {
    if (persistedCatalogRevision <= 0) return;
    setCatalogRevision((prev) => Math.max(prev, persistedCatalogRevision));
  }, [persistedCatalogRevision]);

  useEffect(() => {
    if (persistedTabsCount === 0 && !lastSearchSnapshot) return;
    if (aiConsentStatus === "loading" || needsAiConsentPrompt) return;
    setHasSearched(true);
    setCurrentStep("assistant");
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
    setSelectedCity((prev) => (prev.trim() ? prev : city));
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

  const placeOptions =
    activeTabSnapshot?.catalogPlaces ??
    lastSearchSnapshot?.catalogPlaces ??
    [];

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
    goToAssistantStep();
  }, [effectivePlaces, goToAssistantStep, placeOptions.length, selectedPlace, t]);

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
  const applySearchSnapshot = useCallback(
    (snap: BookingSearchSnapshot) => {
      setSelectedCity(snap.city);
      if (snap.isRestaurantTable) {
        setSelectedCategoryId(RESTAURANT_TABLE_KEY);
        setSelectedCategoryName(restaurantTableLabel);
      } else {
        setSelectedCategoryId(snap.categoryId);
        setSelectedCategoryName(snap.categoryName);
      }
      setScope(snap.scope);
      setRequestComment(snap.requestComment);
      setHasSearched(true);
    },
    [restaurantTableLabel],
  );

  const historyItems = useMemo(
    () =>
      chatTabs
        .map((tab) =>
          buildHistoryItemFromTab({
            tabId: tab.id,
            title: tab.title,
            createdAt: tab.createdAt,
            searchSnapshot: tab.searchSnapshot,
          }),
        )
        .filter((item): item is NonNullable<typeof item> => item != null)
        .reverse(),
    [chatTabs],
  );

  useEffect(() => {
    useBookingChatStore.getState().ensureActiveTab(catalogRevision);
  }, [catalogRevision]);

  useEffect(() => {
    if (profilePending) return;
    if (!activeTabId || !activeTab) return;
    if (activeTab.onboardingPhase !== "greeting") return;
    if (greetingBootstrappedRef.current.has(activeTabId)) return;
    if (activeTab.messages.length > 0) return;
    if (aiConsentStatus === "loading" || needsAiConsentPrompt) return;

    const tabId = activeTabId;
    const hasPrefilledCity = hasOnboardingPrefilledCity(selectedCity, profile?.city);
    greetingBootstrappedRef.current.add(tabId);
    seedOnboardingGreetingMessage(tabId, hasPrefilledCity);
  }, [
    activeTab,
    activeTabId,
    aiConsentStatus,
    needsAiConsentPrompt,
    profile?.city,
    profilePending,
    selectedCity,
  ]);

  useEffect(() => {
    if (profilePending) return;
    if (!activeTabId || !activeTab) return;
    if (activeTab.searchSnapshot) return;
    if (activeTab.onboardingPhase === "gemini" || activeTab.onboardingPhase === "search_results") return;

    const hasPrefilledCity = hasOnboardingPrefilledCity(selectedCity, profile?.city);
    if (!hasPrefilledCity) return;

    const patched = syncOnboardingGreetingMessage(activeTabId, true);
    const store = useBookingChatStore.getState();
    const tab = store.tabs.find((t) => t.id === activeTabId);
    const phase = tab?.onboardingPhase;

    if (!patched) {
      if (phase === "greeting" || phase === "await_city") {
        store.setTabOnboardingPhase(activeTabId, "await_category");
      }
      return;
    }

    const greetingId = onboardingAssistantMessageId(activeTabId, "greeting");
    clearBookingOpeningTypewriterKeys([greetingId]);
    openingReplayGuardRef.current = null;
    if (phase !== "assistant_typing") {
      store.setTabOnboardingPhase(activeTabId, "assistant_typing");
    }
    setOpeningTypewriterEpoch((epoch) => epoch + 1);
  }, [
    activeTab,
    activeTabId,
    aiConsentStatus,
    needsAiConsentPrompt,
    profile?.city,
    profilePending,
    selectedCity,
  ]);

  const handleOnboardingTypewriterComplete = useCallback(
    (messageId: string) => {
      const tabId = useBookingChatStore.getState().activeTabId;
      if (!tabId) return;
      const step = parseOnboardingAssistantStep(messageId);
      if (!step) return;

      const store = useBookingChatStore.getState();
      const hasPrefilledCity = hasOnboardingPrefilledCity(selectedCity, profile?.city);

      const tab = store.tabs.find((t) => t.id === tabId);
      const currentPhase = tab?.onboardingPhase;

      switch (step) {
        case "greeting": {
          const nextPhase = hasPrefilledCity ? "await_category" : "await_city";
          if (currentPhase !== nextPhase) {
            store.setTabOnboardingPhase(tabId, nextPhase);
          }
          break;
        }
        case "category":
          if (currentPhase !== "await_category") {
            store.setTabOnboardingPhase(tabId, "await_category");
          }
          break;
        case "scope":
          if (currentPhase !== "await_scope") {
            store.setTabOnboardingPhase(tabId, "await_scope");
          }
          break;
        case "results":
          if (currentPhase !== "gemini") {
            store.setTabOnboardingPhase(tabId, "gemini");
          }
          break;
      }
    },
    [profile?.city, selectedCity],
  );

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

  const onSearchPlaces = async (scopeOverride?: "nearby" | "city") => {
    if (isSearchingPlaces || isLoading) return;
    if (!ensureProfileComplete()) return;
    const searchScope = scopeOverride ?? scope;
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
    if (searchScope === "nearby" && !coords) {
      coords = await onRequestNearbyPermission();
      if (!coords) {
        setIsSearchingPlaces(false);
        const tabId = useBookingChatStore.getState().activeTabId;
        if (tabId) useBookingChatStore.getState().setTabOnboardingPhase(tabId, "await_scope");
        return;
      }
    }

    const payload: PixAIFlowPayload = {
      city: selectedCity.trim(),
      categoryId: isRestaurantTable ? undefined : selectedCategoryId.trim(),
      categoryName: isRestaurantTable ? restaurantTableLabel : selectedCategoryName,
      isRestaurantTable,
      comment: requestComment.trim() || undefined,
      mode: searchScope,
      radiusMiles: DEFAULT_RADIUS_MILES,
      location: searchScope === "nearby" ? coords ?? undefined : undefined,
      limit: 8,
    };

    try {
      const result = await runFlow(payload);
      const catalogPlaces = result.places ?? [];

      setHasSearched(true);
      setCurrentStep("assistant");
      let nextRev = 0;
      setCatalogRevision((prev) => {
        nextRev = prev + 1;
        return nextRev;
      });
      const snapshot: BookingSearchSnapshot = {
        city: selectedCity.trim(),
        categoryId: isRestaurantTable ? RESTAURANT_TABLE_KEY : selectedCategoryId.trim(),
        categoryName: isRestaurantTable ? restaurantTableLabel : selectedCategoryName || "",
        isRestaurantTable,
        scope: searchScope,
        requestComment: requestComment.trim(),
        catalogPlaces,
        persons: Number(form.persons) || Number(AI_BOOKING_DEFAULT_PERSONS),
        searchedAt: Date.now(),
      };
      const resultsLine = buildSearchResultsLineFromFlow(payload, catalogPlaces.length);
      const tabId = useBookingChatStore.getState().activeTabId;
      if (tabId) {
        seedOnboardingSearchResultsMessage(tabId, resultsLine);
      }
      setTimeout(() => {
        useBookingChatStore.getState().applySearchResults(nextRev, snapshot);
      }, 0);
    } catch (error) {
      if (isAuthRequiredError(error)) {
        navigateToAuthScreen(navigation);
        return;
      }
      Alert.alert(t("bookingCommon.failed"), error instanceof Error ? error.message : t("aiBooking.searchFailed"));
      const tabId = useBookingChatStore.getState().activeTabId;
      if (tabId) useBookingChatStore.getState().setTabOnboardingPhase(tabId, "await_scope");
    } finally {
      setIsSearchingPlaces(false);
    }
  };

  const searchPlacesBusy = isSearchingPlaces || isLoading;

  const onBookPlace = useCallback(
    (place: PixAIPlace) => {
      if (bookingPlaceId) return;
      setBookingPlaceId(place.id);
      setSelectedPlace(place);
      setBookingDateYmd(null);
      setSelectedSlot(null);
      setVisibleCalendarMonth(firstOfMonthContaining(new Date()));
      requestAnimationFrame(() => {
        goToBookingStep();
      });
    },
    [bookingPlaceId, goToBookingStep],
  );

  const buildScopeSearchSnapshot = useCallback(
    (searchScope: "nearby" | "city", catalogPlaces: PixAIPlace[] = []): BookingSearchSnapshot => ({
      city: selectedCity.trim(),
      categoryId: isRestaurantTable ? RESTAURANT_TABLE_KEY : selectedCategoryId.trim(),
      categoryName: isRestaurantTable ? restaurantTableLabel : selectedCategoryName || "",
      isRestaurantTable,
      scope: searchScope,
      requestComment: requestComment.trim(),
      catalogPlaces,
      persons: Number(form.persons) || Number(AI_BOOKING_DEFAULT_PERSONS),
      searchedAt: Date.now(),
    }),
    [
      form.persons,
      isRestaurantTable,
      requestComment,
      restaurantTableLabel,
      selectedCategoryId,
      selectedCategoryName,
      selectedCity,
    ],
  );

  const onScopeSelected = useCallback(
    (selectedScope: "nearby" | "city") => {
      setScope(selectedScope);
      const label = selectedScope === "nearby" ? nearMeLabel : allPlacesInMyCityLabel;
      const tabId = useBookingChatStore.getState().activeTabId;
      if (tabId) {
        const store = useBookingChatStore.getState();
        store.appendUserMessage(tabId, label);
        store.commitSearchSnapshot(tabId, buildScopeSearchSnapshot(selectedScope));
        store.setTabOnboardingPhase(tabId, "searching");
      }
      void onSearchPlaces(selectedScope);
    },
    [allPlacesInMyCityLabel, buildScopeSearchSnapshot, nearMeLabel, onSearchPlaces],
  );

  const onSelectHistoryTab = useCallback(
    (tabId: string) => {
      useBookingChatStore.getState().setActiveTab(tabId);
      const tab = useBookingChatStore.getState().tabs.find((t) => t.id === tabId);
      if (tab?.searchSnapshot) applySearchSnapshot(tab.searchSnapshot);
      setSelectedPlace(null);
      setSelectedSlot(null);
      setBookingDateYmd(null);
      goToAssistantStep();
    },
    [applySearchSnapshot, goToAssistantStep],
  );

  const resetAssistantSessionState = useCallback(() => {
    setSelectedCity(profile?.city?.trim() ?? "");
    setSelectedCategoryId("");
    setSelectedCategoryName("");
    setScope("city");
    setRequestComment("");
    setHasSearched(false);
    setSelectedPlace(null);
    setSelectedSlot(null);
    setBookingDateYmd(null);
    setLocationCoords(null);
    resetFlowSearchTranscript();
  }, [profile?.city, resetFlowSearchTranscript]);

  const onNewRequest = useCallback(() => {
    resetAssistantSessionState();
    const tabId = useBookingChatStore.getState().addTab(catalogRevision);
    greetingBootstrappedRef.current.delete(tabId);
    setCurrentStep("assistant");
  }, [catalogRevision, resetAssistantSessionState]);

  const confirmResetChat = useCallback(() => {
    const tabId = useBookingChatStore.getState().activeTabId;
    if (tabId) greetingBootstrappedRef.current.delete(tabId);
    openingReplayGuardRef.current = null;
    useBookingChatStore.getState().resetActiveTabChat();
    resetAssistantSessionState();
    resetFlowSearchTranscript();
    setOpeningTypewriterEpoch((epoch) => epoch + 1);
  }, [resetAssistantSessionState, resetFlowSearchTranscript]);

  const onResetChat = useCallback(() => {
    setResetChatConfirmVisible(true);
  }, []);

  const personsCount = Number(form.persons) || Number(AI_BOOKING_DEFAULT_PERSONS);
  const bookingTimeLabel = selectedSlot?.label ?? null;

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
      <OnboardingStepTransition
        stepKey={currentStep}
        direction={stepDirection}
        canSwipeForward={false}
        canSwipeBack={currentStep === "booking"}
        instantBackOnSwipe
        onSwipeForward={() => {}}
        onSwipeBack={goToAssistantStep}
      >
        <ScrollView
          ref={bookingScrollRef}
          style={styles.root}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          contentOffset={initialScrollOffsetRef.current}
          scrollEventThrottle={16}
          onScroll={(e) => {
            const y = e.nativeEvent.contentOffset.y;
            bookingScrollYRef.current = y;
            if (currentStepRef.current === "assistant") {
              assistantScrollYRef.current = y;
            }
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
            <AppPressable style={styles.backBtn} onPress={onHeaderBackPress}>
              <Ionicons name="arrow-back" size={18} color={colors.text} />
            </AppPressable>
            <Text style={styles.title}>{t("aiBooking.title")}</Text>
          </View>
          <Text style={styles.subtitle}>{t("aiBooking.subtitle")}</Text>
        </View>

        {currentStep === "assistant" ? (
          <View style={styles.semanticSection}>
            <View style={styles.stepTitleRow}>
              <AppPressable
                style={styles.menuBtn}
                accessibilityRole="button"
                accessibilityLabel={t("aiBooking.openHistoryA11y")}
                onPress={() => setHistoryOpen(true)}
              >
                <Ionicons name="menu" size={20} color={colors.text} />
              </AppPressable>
              <Text style={[styles.stepTitle, { flex: 1 }]}>{t("aiBooking.step1AssistantTitle")}</Text>
              <AppPressable
                style={styles.menuBtn}
                accessibilityRole="button"
                accessibilityLabel={t("aiBooking.resetChatA11y")}
                onPress={onResetChat}
              >
                <Ionicons name="refresh" size={18} color={colors.textMuted} />
              </AppPressable>
            </View>
            {aiConsentStatus === "loading" || aiConsentStatus === "pending" ? (
              <BookingAssistantChatSkeleton />
            ) : (
              <AiBookingAssistantGate>
                <BookingInlineAssistantChat
                catalogRevision={catalogRevision}
                bookingContext={bookingChatContext}
                places={placeOptions}
                composerInputRef={bookingComposerInputRef}
                onComposerInputFocus={onBookingComposerInputFocus}
                onComposerInputBlur={onBookingComposerInputBlur}
                onboardingPhase={onboardingPhase}
                openingTypewriterEpoch={openingTypewriterEpoch}
                searchPlacesBusy={searchPlacesBusy}
                onOnboardingTypewriterComplete={handleOnboardingTypewriterComplete}
                nearMeLabel={nearMeLabel}
                allPlacesInMyCityLabel={allPlacesInMyCityLabel}
                onOpenCityPicker={() => {
                  setCitySearchQuery("");
                  setCityPickerVisible(true);
                }}
                onOpenCategoryPicker={() => setCategoryPickerVisible(true)}
                onScopeSelected={onScopeSelected}
              />
              </AiBookingAssistantGate>
            )}
          </View>
        ) : null}

        {currentStep === "assistant" && hasSearched && placeOptions.length > 0 ? (
          <AIBookingSuggestedPlaces
            styles={styles}
            places={effectivePlaces}
            selectedPlace={selectedPlace}
            personsCount={personsCount}
            bookingTimeLabel={bookingTimeLabel}
            bookingPlaceId={bookingPlaceId}
            onBook={onBookPlace}
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

        {currentStep === "booking" ? (
          <View style={styles.footer}>
            <View style={styles.row}>
              <AppPressable
                style={[styles.footerBtn, { flex: 1 }]}
                onPress={goToAssistantStep}
              >
                <Text
                  style={styles.footerBtnText}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  {t("bookingCommon.backStep")}
                </Text>
              </AppPressable>
            </View>
          </View>
        ) : null}
      </OnboardingStepTransition>

      <BookingRequestHistoryDrawer
        visible={historyOpen}
        items={historyItems}
        activeTabId={activeTabId}
        onClose={() => setHistoryOpen(false)}
        onSelectTab={onSelectHistoryTab}
        onNewRequest={onNewRequest}
      />

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
              <AppPressable
                key={city}
                style={styles.pickerRow}
                onPress={() => {
                  setSelectedCity(city);
                  setCitySearchQuery("");
                  setCityPickerVisible(false);
                  const tabId = useBookingChatStore.getState().activeTabId;
                  if (tabId) {
                    useBookingChatStore.getState().appendUserMessage(tabId, city);
                    seedOnboardingCategoryQuestion(tabId);
                    useBookingChatStore.getState().setTabOnboardingPhase(tabId, "assistant_typing");
                  }
                }}
              >
                <Text style={styles.pickerRowText}>{city}</Text>
                {selectedCity === city ? <Text style={styles.pickerCheck}>{t("bookingCommon.selected")}</Text> : null}
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
            <AppPressable
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
                let categoryLabel: string;
                if (isRestaurantCategoryName(category.name)) {
                  setSelectedCategoryId(RESTAURANT_TABLE_KEY);
                  setSelectedCategoryName(restaurantTableLabel);
                  categoryLabel = restaurantTableLabel;
                } else {
                  setSelectedCategoryId(category.id);
                  setSelectedCategoryName(category.name);
                  categoryLabel = localizeCategoryName(category.name, t);
                }
                setCategoryPickerVisible(false);
                const tabId = useBookingChatStore.getState().activeTabId;
                if (tabId) {
                  useBookingChatStore.getState().appendUserMessage(tabId, categoryLabel);
                  seedOnboardingScopeQuestion(tabId);
                  useBookingChatStore.getState().setTabOnboardingPhase(tabId, "assistant_typing");
                }
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
            </AppPressable>
          );
        })}
      </BottomSheetPickerModal>

      <Modal
        visible={resetChatConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setResetChatConfirmVisible(false)}
      >
        <AppPopupModal
          embedded
          visible={resetChatConfirmVisible}
          variant="alert"
          title={t("aiBooking.resetChatTitle")}
          message={t("aiBooking.resetChatMessage")}
          onClose={() => setResetChatConfirmVisible(false)}
          buttons={[
            { text: t("common.cancel"), style: "cancel" },
            {
              text: t("aiBooking.resetChatConfirm"),
              style: "destructive",
              onPress: confirmResetChat,
            },
          ]}
        />
      </Modal>
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
