import { AppPressable } from "@/shared/ui/app-pressable";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type SetStateAction } from "react";
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
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { useCartItems, useCreateCartItem, useStartN8nWaBooking } from "@/entities/cart";
import { useCreateBooking } from "@/entities/booking";
import {
  useAvailableSlots,
  findBookingSlotForTime,
  minutesFromDate,
  defaultBookingDateTime,
  resolveBookingTimeUnavailableReason,
  RESTAURANT_BOOKING_TIME_WINDOWS,
} from "@/entities/booking";
import {
  isPixaiOrchestrateInsufficientCreditsError,
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
  useSubscriptionGatedNavigation,
  useSubscriptionPaywallRedirect,
} from "@/features/subscription-paywall-redirect";
import {
  ALL_CITIES_OPTION,
  useAvailableCities,
  groupCitiesByCountry,
  filterCityGroups,
  countryLabelForCity,
  extractCityFromQuery,
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
import {
  BookingProfileCompleteTip,
  showGuestFormValidationPopup,
  showMissingAvailableSlotPopup,
  showMissingBookingDatePopup,
  showMissingBookingSlotPopup,
  type GuestFormFieldError,
} from "@/features/booking-personal-data-notice";
import { isPersonalDataComplete } from "@/shared/lib/profileCompletion";
import { BottomSheetPickerModal } from "@/shared/ui/bottom-sheet-picker/BottomSheetPickerModal";
import { useBookingAccess } from "@/features/booking-access";
import { useBookingCreditsSync } from "@/entities/booking-credits";
import { BookingCreditsBadge } from "@/shared/ui/booking-credits-badge/BookingCreditsBadge";
import { useTranslation } from "react-i18next";
import { PageI18nProvider } from "@/shared/lib/i18n";
import { isAuthRequiredError, navigateToAuthScreen } from "@/shared/lib/auth/authRequired";
import { useScrollToFocusedInput } from "@/shared/lib/keyboard";
import {
  DEFAULT_PHONE_VALUE,
  parseStoredPhone,
  serializePhone,
  validatePhoneValue,
  type PhoneValue,
} from "@/shared/ui/phone-input";
import { useAIBookingStyles } from "./aiBookingStyles";
import { AIBookingSelectedPlaceDetails } from "./AIBookingSelectedPlaceDetails";
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
import { useDisableGestureDuringTransition } from "@/shared/lib/navigation/useDisableGestureDuringTransition";
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
import { markBookingOpeningTypewriterComplete } from "@/features/ai-booking-chat/lib/bookingOpeningTypewriterRegistry";
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
  seedOnboardingSearchResultsMessage,
  syncOnboardingGreetingMessage,
} from "@/features/ai-booking-onboarding";
import { AiBookingAssistantGate, AiBookingStepConsentPrompt, refreshAiDataConsent, useAiDataConsent } from "@/features/ai-data-consent";
import { devWarn } from "@/shared/lib/devLog";
import { AppPopupModal, appAlert } from "@/shared/ui/app-popup";
import { BookingWhatsAppBanner } from "@/pages/booking-flow/ui/BookingWhatsAppBanner";
import { bookingChannelFromPhone } from "@/shared/lib/booking/bookingChannel";
import {
  trackBookingScreenOpened,
  trackBookingStarted,
  trackBookingConfirmed,
} from "@/shared/lib/analytics/track";
import {
  AI_BOOKING_COMPOSER_KEYBOARD_MARGIN,
  AI_BOOKING_DEFAULT_PERSONS,
} from "../model/constants";

const DEFAULT_BOOKING_REC_VIEW: BookingRecommendationView = {
  rerankedPlaceIds: [],
  excludedPlaceIds: [],
  filters: {},
};
const EMPTY_PLACE_OPTIONS: PixAIPlace[] = [];

type DraftForm = AIBookingDraftForm;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESTAURANT_TABLE_KEY = "restaurant-table";
const DEFAULT_RADIUS_MILES = 5;
const BUILD_ROUTE_GRADIENT_LIGHT = ["#9333ea", "#db2777", "#f97316"] as const;
const BUILD_ROUTE_GRADIENT_DARK = ["#6d28d9", "#be185d", "#ea580c"] as const;

/** A quick-search request captured before the city is known — resumed once city resolves. */
type PendingQuickSearch =
  | { kind: "text"; query: string }
  | { kind: "category"; categoryId: string; categoryName: string; isRestaurantTable: boolean };

type FlowStep = "assistant" | "booking";
type Nav = NativeStackNavigationProp<BrowseFlowParamList, "AIBooking">;
type AIBookingRoute = RouteProp<BrowseFlowParamList, "AIBooking">;

type AIBookingSearchForm = {
  city: string;
  categoryId: string;
  categoryName: string;
  scope: "nearby" | "city";
  comment: string;
  locationCoords: { lat: number; lng: number } | null;
};

type AIBookingSelection = {
  hasSearched: boolean;
  place: PixAIPlace | null;
  bookingTime: Date | null;
  bookingDateYmd: string | null;
  bookingPlaceId: string | null;
  visibleCalendarMonth: Date;
};

type AIBookingUiState = {
  cityPickerVisible: boolean;
  citySearchQuery: string;
  categoryPickerVisible: boolean;
  historyOpen: boolean;
  resetChatConfirmVisible: boolean;
  confirmingBooking: boolean;
  isSearchingPlaces: boolean;
};

type AIBookingFlowState = {
  step: FlowStep;
  direction: 1 | -1;
};
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
  const { onInputFocus: onBookingFormInputFocus, onScroll: onBookingFormScroll } = useScrollToFocusedInput(
    bookingScrollRef,
    { scrollOffsetYRef: bookingScrollYRef },
  );
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
  const manualCitySelectionRef = useRef(false);
  const pendingQuickSearchRef = useRef<PendingQuickSearch | null>(null);
  const [openingTypewriterEpoch, setOpeningTypewriterEpoch] = useState(0);
  const [flow, setFlow] = useState<AIBookingFlowState>(() => ({
    step: initialStepRef.current,
    direction: 1,
  }));
  const currentStep = flow.step;
  const stepDirection = flow.direction;
  const [searchForm, setSearchForm] = useState<AIBookingSearchForm>({
    city: "",
    categoryId: "",
    categoryName: "",
    scope: "city",
    comment: "",
    locationCoords: null,
  });
  const selectedCity = searchForm.city;
  const selectedCategoryId = searchForm.categoryId;
  const isRestaurantTable = selectedCategoryId === RESTAURANT_TABLE_KEY;
  const selectedCategoryName = searchForm.categoryName;
  const scope = searchForm.scope;
  const requestComment = searchForm.comment;
  const locationCoords = searchForm.locationCoords;
  const [selection, setSelection] = useState<AIBookingSelection>(() => ({
    hasSearched: false,
    place: null,
    bookingTime: null,
    bookingDateYmd: null,
    bookingPlaceId: null,
    visibleCalendarMonth: firstOfMonthContaining(new Date()),
  }));
  const hasSearched = selection.hasSearched;
  const selectedPlace = selection.place;
  const selectedBookingTime = selection.bookingTime;
  const bookingDateYmd = selection.bookingDateYmd;
  const bookingPlaceId = selection.bookingPlaceId;
  const visibleCalendarMonth = selection.visibleCalendarMonth;
  const [uiState, setUiState] = useState<AIBookingUiState>({
    cityPickerVisible: false,
    citySearchQuery: "",
    categoryPickerVisible: false,
    historyOpen: false,
    resetChatConfirmVisible: false,
    confirmingBooking: false,
    isSearchingPlaces: false,
  });
  const cityPickerVisible = uiState.cityPickerVisible;
  const citySearchQuery = uiState.citySearchQuery;
  const categoryPickerVisible = uiState.categoryPickerVisible;
  const historyOpen = uiState.historyOpen;
  const resetChatConfirmVisible = uiState.resetChatConfirmVisible;
  const confirmingBooking = uiState.confirmingBooking;
  const isSearchingPlaces = uiState.isSearchingPlaces;
  const [form, setForm] = useState<DraftForm>({
    persons: AI_BOOKING_DEFAULT_PERSONS,
    customer_name: "",
    customer_phone: DEFAULT_PHONE_VALUE,
    customer_email: "",
    comment: "",
  });
  const [catalogRevision, setCatalogRevision] = useState(0);

  const setVisibleCalendarMonth = useCallback((action: SetStateAction<Date>) => {
    setSelection((prev) => ({
      ...prev,
      visibleCalendarMonth:
        typeof action === "function" ? action(prev.visibleCalendarMonth) : action,
    }));
  }, []);

  const setBookingDateYmd = useCallback((ymd: string | null) => {
    setSelection((prev) => ({ ...prev, bookingDateYmd: ymd }));
  }, []);

  const setSelectedBookingTime = useCallback((time: Date | null) => {
    setSelection((prev) => ({ ...prev, bookingTime: time }));
  }, []);

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

  const { colors, isDark } = useAppTheme();
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
    balance,
    isIntroActive,
    hasPaidPremium,
    introPeriodEndsAt,
  } = useBookingAccess();
  const { syncBalance, refreshBalance } = useBookingCreditsSync();
  const shouldEnforcePaywall = shouldEnforceSubscriptionPaywall();
  const navigation = useNavigation<Nav>();
  const { openVibeMatch } = useSubscriptionGatedNavigation(navigation);
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

  const { data: availableCities = [ALL_CITIES_OPTION] } = useAvailableCities();
  const { data: categories = [] } = useCategories();
  const bookingCategoryOptions = useMemo(() => buildHomeCategoryList(categories), [categories]);
  const createCartItem = useCreateCartItem();
  const createBooking = useCreateBooking();
  const startN8nWaBooking = useStartN8nWaBooking();
  const { data: cartItems = [] } = useCartItems();
  useDisableGestureDuringTransition({ restoreGestureEnabled: currentStep === "assistant" });

  const goToAssistantStep = useCallback(() => {
    setFlow((prev) => ({ ...prev, step: "assistant", direction: -1 }));
  }, []);

  const goToBookingStep = useCallback(() => {
    assistantScrollYRef.current = bookingScrollYRef.current;
    setFlow((prev) => ({ ...prev, step: "booking", direction: 1 }));
  }, []);

  const handleOpenBuildRoute = useCallback(() => {
    openVibeMatch({
      prefillCity: selectedCity?.trim() || undefined,
      prefillMood: selectedCategoryName ? localizeCategoryName(selectedCategoryName, t) : undefined,
      sourceFlow: "ai_concierge",
    });
  }, [openVibeMatch, selectedCity, selectedCategoryName, t]);

  useLayoutEffect(() => {
    currentStepRef.current = currentStep;
    if (currentStep !== "booking") return;
    setSelection((prev) => ({ ...prev, bookingPlaceId: null }));
    bookingScrollRef.current?.scrollTo({ y: 0, animated: false });
    bookingScrollYRef.current = 0;
  }, [currentStep]);

  useEffect(() => {
    if (currentStep === "booking" && selectedPlace) {
      trackBookingScreenOpened("ai_booking", selectedPlace.id);
    }
    // intentionally omit selectedPlace — track once per step transition
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setSelection((prev) => ({ ...prev, hasSearched: true }));
    setFlow((prev) => ({ ...prev, step: "assistant" }));
  }, [aiConsentStatus, needsAiConsentPrompt, persistedTabsCount, lastSearchSnapshot]);

  useEffect(() => {
    const snap = lastSearchSnapshot;
    if (!snap) return;
    setSearchForm((prev) => ({
      ...prev,
      city: prev.city.trim() ? prev.city : snap.city,
      categoryId: prev.categoryId.trim()
        ? prev.categoryId
        : snap.isRestaurantTable
          ? RESTAURANT_TABLE_KEY
          : snap.categoryId,
      categoryName: prev.categoryName.trim()
        ? prev.categoryName
        : snap.isRestaurantTable
          ? restaurantTableLabel
          : snap.categoryName,
      scope: snap.scope,
      comment: prev.comment.trim() ? prev.comment : snap.requestComment,
    }));
  }, [lastSearchSnapshot, restaurantTableLabel]);

  const concreteCities = useMemo(
    () => availableCities.filter((c) => c !== ALL_CITIES_OPTION),
    [availableCities],
  );

  const filteredCityGroups = useMemo(() => {
    const grouped = groupCitiesByCountry(concreteCities);
    return filterCityGroups(grouped, citySearchQuery);
  }, [concreteCities, citySearchQuery]);

  const showProfileCompleteTip = !isPersonalDataComplete(profile);

  const styles = useAIBookingStyles({ top: insets.top, bottom: insets.bottom });

  useEffect(() => {
    const city = profile?.city?.trim();
    if (!city) return;
    if (aiConsentStatus === "loading" || needsAiConsentPrompt) return;
    setSearchForm((prev) => (prev.city.trim() ? prev : { ...prev, city }));
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

  const placeOptions = useMemo(
    () => activeTabSnapshot?.catalogPlaces ?? lastSearchSnapshot?.catalogPlaces ?? EMPTY_PLACE_OPTIONS,
    [activeTabSnapshot?.catalogPlaces, lastSearchSnapshot?.catalogPlaces],
  );

  const searchMeta = useMemo(
    () => activeTabSnapshot?.searchMeta ?? lastSearchSnapshot?.searchMeta ?? null,
    [activeTabSnapshot?.searchMeta, lastSearchSnapshot?.searchMeta],
  );

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
    setSelection((prev) => ({
      ...prev,
      place: null,
      bookingDateYmd: null,
      bookingTime: null,
    }));
    goToAssistantStep();
  }, [effectivePlaces, goToAssistantStep, placeOptions.length, selectedPlace, t]);

  const {
    data: slotsForDate = [],
    isFetching: slotsFetching,
    isError: slotsError,
    refetch: refetchSlots,
  } = useAvailableSlots(selectedPlace?.id ?? null, bookingDateYmd, isRestaurantTable ? RESTAURANT_BOOKING_TIME_WINDOWS : undefined);

  const cartReservedSlotTimes = useMemo(() => {
    const s = new Set<number>();
    if (!selectedPlace) return s;
    for (const it of cartItems) {
      if (it.business_card_id !== selectedPlace.id) continue;
      s.add(new Date(it.date_time).getTime());
    }
    return s;
  }, [cartItems, selectedPlace]);

  useEffect(() => {
    if (!bookingDateYmd) {
      setSelectedBookingTime(null);
      return;
    }
    setSelectedBookingTime(defaultBookingDateTime(bookingDateYmd));
  }, [bookingDateYmd]);

  const selectedSlot = useMemo((): PixAISlot | null => {
    if (!selectedBookingTime || !bookingDateYmd) return null;
    const totalMinutes = minutesFromDate(selectedBookingTime);
    const slot = findBookingSlotForTime(slotsForDate, totalMinutes);
    const inCart =
      slot != null && cartReservedSlotTimes.has(new Date(slot.dateTimeIso).getTime());
    const unavailable = resolveBookingTimeUnavailableReason({
      slot,
      dateYmd: bookingDateYmd,
      totalMinutes,
      reservedInCart: inCart,
    });
    if (unavailable || !slot) return null;
    if (inCart) return { ...slot, available: false };
    return slot;
  }, [selectedBookingTime, bookingDateYmd, slotsForDate, cartReservedSlotTimes]);

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
      setSearchForm((prev) => ({
        ...prev,
        city: snap.city,
        categoryId: snap.isRestaurantTable ? RESTAURANT_TABLE_KEY : snap.categoryId,
        categoryName: snap.isRestaurantTable ? restaurantTableLabel : snap.categoryName,
        scope: snap.scope,
        comment: snap.requestComment,
      }));
      setSelection((prev) => ({ ...prev, hasSearched: true }));
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
    if (!hasPrefilledCity) return;
    greetingBootstrappedRef.current.add(tabId);
    seedOnboardingGreetingMessage(tabId);
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

    const patched = syncOnboardingGreetingMessage(activeTabId);
    const store = useBookingChatStore.getState();
    const tab = store.tabs.find((t) => t.id === activeTabId);
    const phase = tab?.onboardingPhase;

    if (!patched) {
      if (manualCitySelectionRef.current) {
        manualCitySelectionRef.current = false;
      }
      if (phase === "greeting" || phase === "await_city") {
        store.setTabOnboardingPhase(activeTabId, "await_category");
      }
      return;
    }

    const greetingId = onboardingAssistantMessageId(activeTabId, "greeting");
    manualCitySelectionRef.current = false;
    markBookingOpeningTypewriterComplete(greetingId);
    if (phase === "greeting" || phase === "await_city" || phase === "assistant_typing") {
      store.setTabOnboardingPhase(activeTabId, "await_category");
    }
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
        case "results": {
          const hasPlaces = (tab?.searchSnapshot?.catalogPlaces.length ?? 0) > 0;
          const nextPhase = hasPlaces ? "gemini" : "await_category";
          if (currentPhase !== nextPhase) {
            store.setTabOnboardingPhase(tabId, nextPhase);
          }
          break;
        }
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
    setSearchForm((prev) => ({ ...prev, locationCoords: coords }));
    return coords;
  };

  const onSearchPlaces = async (scopeOverride?: "nearby" | "city") => {
    if (isSearchingPlaces || isLoading) return;
    const searchScope = scopeOverride ?? scope;
    if (!selectedCity || selectedCity === ALL_CITIES_OPTION) {
      Alert.alert(t("bookingCommon.chooseCity"), t("bookingCommon.chooseCityMessage"));
      return;
    }
    if (!selectedCategoryId) {
      Alert.alert(t("aiBooking.chooseRequestTitle"), t("aiBooking.chooseRequestMessage"));
      return;
    }

    setUiState((prev) => ({ ...prev, isSearchingPlaces: true }));
    resetFlowSearchTranscript();
    setSelection((prev) => ({
      ...prev,
      place: null,
      bookingTime: null,
      bookingDateYmd: null,
    }));

    let coords = locationCoords;
    if (searchScope === "nearby" && !coords) {
      coords = await onRequestNearbyPermission();
      if (!coords) {
        setUiState((prev) => ({ ...prev, isSearchingPlaces: false }));
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
      if (result.credits) syncBalance(result.credits);
      const catalogPlaces = result.places ?? [];

      setSelection((prev) => ({ ...prev, hasSearched: true }));
      setFlow((prev) => ({ ...prev, step: "assistant" }));
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
        searchMeta: result.meta ?? null,
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
      if (isPixaiOrchestrateInsufficientCreditsError(error)) {
        void refreshBalance();
        navigation.replace("SubscriptionPaywall", { reason: "no_credits" });
        return;
      }
      if (isAuthRequiredError(error)) {
        navigateToAuthScreen(navigation);
        return;
      }
      Alert.alert(t("bookingCommon.failed"), error instanceof Error ? error.message : t("aiBooking.searchFailed"));
      const tabId = useBookingChatStore.getState().activeTabId;
      if (tabId) useBookingChatStore.getState().setTabOnboardingPhase(tabId, "await_scope");
    } finally {
      setUiState((prev) => ({ ...prev, isSearchingPlaces: false }));
    }
  };

  const searchPlacesBusy = isSearchingPlaces || isLoading;

  /**
   * Shared runner for the two "quick search" shortcuts below (free text + category tap).
   * Kept separate from onSearchPlaces (the structured city/category/scope path) so neither
   * shortcut can ever affect that primary search flow.
   */
  const executeQuickSearch = useCallback(
    async (
      payload: PixAIFlowPayload,
      snapshotFields: Pick<BookingSearchSnapshot, "categoryId" | "categoryName" | "isRestaurantTable" | "requestComment">,
    ) => {
      setUiState((prev) => ({ ...prev, isSearchingPlaces: true }));
      resetFlowSearchTranscript();
      setSelection((prev) => ({ ...prev, place: null, bookingTime: null, bookingDateYmd: null }));

      const tabId = useBookingChatStore.getState().activeTabId;
      if (tabId) useBookingChatStore.getState().setTabOnboardingPhase(tabId, "searching");

      try {
        const result = await runFlow(payload);
        if (result.credits) syncBalance(result.credits);
        const catalogPlaces = result.places ?? [];

        setSelection((prev) => ({ ...prev, hasSearched: true }));
        setFlow((prev) => ({ ...prev, step: "assistant" }));
        let nextRev = 0;
        setCatalogRevision((prev) => {
          nextRev = prev + 1;
          return nextRev;
        });
        const snapshot: BookingSearchSnapshot = {
          city: payload.city,
          scope: "city",
          catalogPlaces,
          persons: Number(form.persons) || Number(AI_BOOKING_DEFAULT_PERSONS),
          searchedAt: Date.now(),
          searchMeta: result.meta ?? null,
          ...snapshotFields,
        };
        const resultsLine = buildSearchResultsLineFromFlow(payload, catalogPlaces.length);
        if (tabId) seedOnboardingSearchResultsMessage(tabId, resultsLine);
        setTimeout(() => {
          useBookingChatStore.getState().applySearchResults(nextRev, snapshot);
        }, 0);
      } catch (error) {
        if (isPixaiOrchestrateInsufficientCreditsError(error)) {
          void refreshBalance();
          navigation.replace("SubscriptionPaywall", { reason: "no_credits" });
          return;
        }
        if (isAuthRequiredError(error)) {
          navigateToAuthScreen(navigation);
          return;
        }
        Alert.alert(t("bookingCommon.failed"), error instanceof Error ? error.message : t("aiBooking.searchFailed"));
        if (tabId) useBookingChatStore.getState().setTabOnboardingPhase(tabId, "greeting");
      } finally {
        setUiState((prev) => ({ ...prev, isSearchingPlaces: false }));
      }
    },
    [form.persons, navigation, refreshBalance, resetFlowSearchTranscript, runFlow, syncBalance, t],
  );

  /** Free-form query typed before (or instead of) the structured prompts — searches immediately. */
  const runFreeTextSearch = useCallback(
    async (rawQuery: string, cityOverride?: string) => {
      const query = rawQuery.trim();
      if (!query || isSearchingPlaces || isLoading) return;
      const mentionedCity = extractCityFromQuery(query, availableCities);
      const cityValue = (mentionedCity ?? cityOverride ?? selectedCity).trim();
      if (!cityValue || cityValue === ALL_CITIES_OPTION) {
        pendingQuickSearchRef.current = { kind: "text", query };
        setUiState((prev) => ({ ...prev, citySearchQuery: "", cityPickerVisible: true }));
        return;
      }

      const truncatedQuery = query.length > 40 ? `${query.slice(0, 40)}…` : query;
      setSearchForm((prev) => ({
        ...prev,
        city: cityValue,
        categoryId: "",
        categoryName: "",
        scope: "city",
        comment: query,
      }));

      await executeQuickSearch(
        {
          city: cityValue,
          comment: query,
          mode: "city",
          radiusMiles: DEFAULT_RADIUS_MILES,
          limit: 8,
        },
        {
          categoryId: "",
          categoryName: truncatedQuery,
          isRestaurantTable: false,
          requestComment: query,
        },
      );
    },
    [availableCities, executeQuickSearch, isLoading, isSearchingPlaces, selectedCity],
  );

  /** Category tap during onboarding — searches immediately, skipping the scope question. */
  const runCategorySearch = useCallback(
    async (
      category: { categoryId: string; categoryName: string; isRestaurantTable: boolean },
      cityOverride?: string,
    ) => {
      if (isSearchingPlaces || isLoading) return;
      const cityValue = (cityOverride ?? selectedCity).trim();
      if (!cityValue || cityValue === ALL_CITIES_OPTION) {
        pendingQuickSearchRef.current = { kind: "category", ...category };
        setUiState((prev) => ({ ...prev, citySearchQuery: "", cityPickerVisible: true }));
        return;
      }

      const categoryLabel = category.isRestaurantTable ? restaurantTableLabel : category.categoryName;
      setSearchForm((prev) => ({
        ...prev,
        city: cityValue,
        categoryId: category.isRestaurantTable ? RESTAURANT_TABLE_KEY : category.categoryId,
        categoryName: categoryLabel,
        scope: "city",
        comment: "",
      }));

      await executeQuickSearch(
        {
          city: cityValue,
          categoryId: category.isRestaurantTable ? undefined : category.categoryId,
          categoryName: categoryLabel,
          isRestaurantTable: category.isRestaurantTable,
          mode: "city",
          radiusMiles: DEFAULT_RADIUS_MILES,
          limit: 8,
        },
        {
          categoryId: category.isRestaurantTable ? RESTAURANT_TABLE_KEY : category.categoryId,
          categoryName: categoryLabel,
          isRestaurantTable: category.isRestaurantTable,
          requestComment: "",
        },
      );
    },
    [executeQuickSearch, isLoading, isSearchingPlaces, restaurantTableLabel, selectedCity],
  );

  const handleFreeTextQuery = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const tabId = useBookingChatStore.getState().activeTabId;
      if (tabId) useBookingChatStore.getState().appendUserMessage(tabId, trimmed);
      void runFreeTextSearch(trimmed);
    },
    [runFreeTextSearch],
  );

  const onBookPlace = useCallback(
    (place: PixAIPlace) => {
      if (bookingPlaceId) return;
      setSelection((prev) => ({
        ...prev,
        bookingPlaceId: place.id,
        place,
        bookingDateYmd: null,
        bookingTime: null,
        visibleCalendarMonth: firstOfMonthContaining(new Date()),
      }));
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
      setSearchForm((prev) => ({ ...prev, scope: selectedScope }));
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
      setSelection((prev) => ({
        ...prev,
        place: null,
        bookingTime: null,
        bookingDateYmd: null,
      }));
      goToAssistantStep();
    },
    [applySearchSnapshot, goToAssistantStep],
  );

  const resetAssistantSessionState = useCallback(() => {
    setSearchForm({
      city: profile?.city?.trim() ?? "",
      categoryId: "",
      categoryName: "",
      scope: "city",
      comment: "",
      locationCoords: null,
    });
    setSelection((prev) => ({
      ...prev,
      hasSearched: false,
      place: null,
      bookingTime: null,
      bookingDateYmd: null,
    }));
    resetFlowSearchTranscript();
  }, [profile?.city, resetFlowSearchTranscript]);

  const onNewRequest = useCallback(() => {
    resetAssistantSessionState();
    const tabId = useBookingChatStore.getState().addTab(catalogRevision);
    greetingBootstrappedRef.current.delete(tabId);
    setFlow((prev) => ({ ...prev, step: "assistant" }));
  }, [catalogRevision, resetAssistantSessionState]);

  const confirmResetChat = useCallback(() => {
    const tabId = useBookingChatStore.getState().activeTabId;
    if (tabId) greetingBootstrappedRef.current.delete(tabId);
    useBookingChatStore.getState().resetActiveTabChat();
    resetAssistantSessionState();
    resetFlowSearchTranscript();
    setOpeningTypewriterEpoch((epoch) => epoch + 1);
  }, [resetAssistantSessionState, resetFlowSearchTranscript]);

  const onResetChat = useCallback(() => {
    setUiState((prev) => ({ ...prev, resetChatConfirmVisible: true }));
  }, []);

  const personsCount = Number(form.persons) || Number(AI_BOOKING_DEFAULT_PERSONS);
  const bookingTimeLabel = selectedSlot?.label ?? null;

  const getGuestFormError = (): GuestFormFieldError | null => {
    if (!validationSchema.persons(form.persons)) return "partySize";
    if (!validationSchema.customer_name(form.customer_name)) return "name";
    if (!validationSchema.customer_phone(form.customer_phone)) return "phone";
    if (!validationSchema.customer_email(form.customer_email)) return "email";
    return null;
  };

  const onCreateDraft = async () => {
    if (confirmingBooking) return;
    if (!selectedPlace) {
      appAlert(t("aiBooking.missingSelectionTitle"), t("aiBooking.missingSelectionMessage"), undefined, "info");
      return;
    }
    if (!bookingDateYmd) {
      showMissingBookingDatePopup(t);
      return;
    }
    if (!selectedSlot) {
      showMissingBookingSlotPopup(t);
      return;
    }
    if (!selectedSlot.available) {
      showMissingAvailableSlotPopup(t);
      return;
    }
    const formError = getGuestFormError();
    if (formError) {
      showGuestFormValidationPopup({ error: formError, t });
      return;
    }
    const persons = Number(form.persons);

    const bookingChannel = bookingChannelFromPhone(selectedPlace.contact_whatsapp);
    trackBookingStarted(selectedPlace.id, bookingChannel);
    setUiState((prev) => ({ ...prev, confirmingBooking: true }));
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
      trackBookingConfirmed(selectedPlace.id, bookingChannel);
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
      Alert.alert(t("bookingCommon.failed"), t("bookingCommon.couldNotCreateDraft"));
    } finally {
      setUiState((prev) => ({ ...prev, confirmingBooking: false }));
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
            onBookingFormScroll(e);
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
          {isIntroActive || hasPaidPremium ? (
            <BookingCreditsBadge
              balance={balance}
              isIntroActive={isIntroActive}
              hasPaidPremium={hasPaidPremium}
              introPeriodEndsAt={introPeriodEndsAt}
              compact
              style={{ marginTop: 6 }}
            />
          ) : null}
        </View>

        {currentStep === "assistant" ? (
          <View style={styles.semanticSection}>
            <View style={styles.stepTitleRow}>
              <AppPressable
                style={styles.menuBtn}
                accessibilityRole="button"
                accessibilityLabel={t("aiBooking.openHistoryA11y")}
                onPress={() => setUiState((prev) => ({ ...prev, historyOpen: true }))}
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
                searchMeta={searchMeta}
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
                  setUiState((prev) => ({ ...prev, citySearchQuery: "", cityPickerVisible: true }));
                }}
                onOpenCategoryPicker={() => setUiState((prev) => ({ ...prev, categoryPickerVisible: true }))}
                onScopeSelected={onScopeSelected}
                onFreeTextQuery={handleFreeTextQuery}
              />
              </AiBookingAssistantGate>
            )}
          </View>
        ) : null}

        {currentStep === "assistant" && hasSearched && placeOptions.length > 0 ? (
          <>
            <AppPressable
              style={styles.buildRouteBtn}
              accessibilityRole="button"
              accessibilityLabel={t("aiBooking.buildRouteTitle")}
              onPress={handleOpenBuildRoute}
            >
              <LinearGradient
                colors={isDark ? [...BUILD_ROUTE_GRADIENT_DARK] : [...BUILD_ROUTE_GRADIENT_LIGHT]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.buildRouteBtnGradient}
              >
                <Ionicons name="map-outline" size={18} color="#ffffff" />
                <View style={styles.buildRouteBtnTextCol}>
                  <Text style={styles.buildRouteBtnTitle}>{t("aiBooking.buildRouteTitle")}</Text>
                  <Text style={styles.buildRouteBtnSub}>{t("aiBooking.buildRouteSub")}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#ffffff88" />
              </LinearGradient>
            </AppPressable>

            <AIBookingSuggestedPlaces
            styles={styles}
            places={effectivePlaces}
            selectedPlace={selectedPlace}
            personsCount={personsCount}
            bookingTimeLabel={bookingTimeLabel}
            bookingPlaceId={bookingPlaceId}
            onBook={onBookPlace}
          />
          </>
        ) : null}

        {currentStep === "booking" && selectedPlace ? (
          <>
            <AIBookingSelectedPlaceDetails styles={styles} selectedPlace={selectedPlace} />
            <BookingWhatsAppBanner channel={bookingChannelFromPhone(selectedPlace.contact_whatsapp)} />
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
              selectedBookingTime={selectedBookingTime}
              onSelectedBookingTimeChange={setSelectedBookingTime}
              slotsForDate={slotsForDate}
              slotsFetching={slotsFetching}
              slotsError={slotsError}
              refetchSlots={refetchSlots}
              cartReservedSlotTimes={cartReservedSlotTimes}
              isRestaurant={isRestaurantTable}
              use12h={countryLabelForCity(selectedCity) === "United States"}
            />
          </>
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
            onInputFocus={onBookingFormInputFocus}
            profileCompleteTip={
              <BookingProfileCompleteTip
                visible={showProfileCompleteTip}
                navigation={navigation}
                style={{ marginTop: 16 }}
              />
            }
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
        onClose={() => setUiState((prev) => ({ ...prev, historyOpen: false }))}
        onSelectTab={onSelectHistoryTab}
        onNewRequest={onNewRequest}
      />

      <BottomSheetPickerModal
        visible={cityPickerVisible}
        onClose={() => {
          pendingQuickSearchRef.current = null;
          setUiState((prev) => ({ ...prev, citySearchQuery: "", cityPickerVisible: false }));
        }}
        title={t("bookingCommon.chooseCity")}
        maxHeightFraction={0.58}
        minHeightFraction={0.38}
        fitContent
      >
        <View style={styles.citySearchBox}>
          <Ionicons name="search-outline" size={20} color={colors.textMuted} />
          <TextInput
            value={citySearchQuery}
            onChangeText={(query) => setUiState((prev) => ({ ...prev, citySearchQuery: query }))}
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
                  setUiState((prev) => ({ ...prev, citySearchQuery: "", cityPickerVisible: false }));
                  const pending = pendingQuickSearchRef.current;
                  if (pending) {
                    pendingQuickSearchRef.current = null;
                    if (pending.kind === "text") {
                      void runFreeTextSearch(pending.query, city);
                    } else {
                      void runCategorySearch(
                        {
                          categoryId: pending.categoryId,
                          categoryName: pending.categoryName,
                          isRestaurantTable: pending.isRestaurantTable,
                        },
                        city,
                      );
                    }
                    return;
                  }
                  manualCitySelectionRef.current = true;
                  setSearchForm((prev) => ({ ...prev, city }));
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
        onClose={() => setUiState((prev) => ({ ...prev, categoryPickerVisible: false }))}
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
                const isRestaurantTableCategory = isRestaurantCategoryName(category.name);
                const categoryLabel = isRestaurantTableCategory
                  ? restaurantTableLabel
                  : localizeCategoryName(category.name, t);
                setUiState((prev) => ({ ...prev, categoryPickerVisible: false }));
                const tabId = useBookingChatStore.getState().activeTabId;
                if (tabId) useBookingChatStore.getState().appendUserMessage(tabId, categoryLabel);
                void runCategorySearch({
                  categoryId: category.id,
                  categoryName: category.name,
                  isRestaurantTable: isRestaurantTableCategory,
                });
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
        onRequestClose={() => setUiState((prev) => ({ ...prev, resetChatConfirmVisible: false }))}
      >
        <AppPopupModal
          embedded
          visible={resetChatConfirmVisible}
          variant="alert"
          title={t("aiBooking.resetChatTitle")}
          message={t("aiBooking.resetChatMessage")}
          onClose={() => setUiState((prev) => ({ ...prev, resetChatConfirmVisible: false }))}
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
