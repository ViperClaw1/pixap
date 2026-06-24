import { AppPressable } from "@/shared/ui/app-pressable";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import * as Haptics from "expo-haptics";
import { showErrorToast, showSuccessToast } from "@/shared/ui/app-toast/showToast";
import { BookingStepIndicator } from "./BookingStepIndicator";
import { BookingConfetti } from "./BookingConfetti";
import { BookingWhatsAppBanner } from "./BookingWhatsAppBanner";
import { bookingChannelFromPhone } from "@/shared/lib/booking/bookingChannel";
import { trackBookingConfirmed } from "@/shared/lib/analytics/track";
import { useTranslation } from "react-i18next";
import { CommonActions, useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useBusinessCard } from "@/entities/business-card";
import { useCreateCartItem, useStartN8nWaBooking } from "@/entities/cart";
import { useAvailableSlots, useCreateBooking } from "@/entities/booking";
import {
  findBookingSlotForTime,
  formatBookingTimeLabel,
  defaultBookingDateTime,
  minutesFromDate,
  resolveBookingTimeUnavailableReason,
} from "@/entities/booking/lib/bookingSlots";
import { useAuth } from "@/app/providers/AuthProvider";
import { useProfile } from "@/entities/user";
import type { BrowseFlowParamList } from "@/app/navigation/types";
import { isAuthRequiredError, navigateToAuthScreen } from "@/shared/lib/auth/authRequired";
import { navigateToProfileAuth } from "@/app/navigation/navigationHelpers";
import { primaryPressableStyle, primaryPressableTextStyle } from "@/shared/theme/primaryPressable";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";
import { bookingFlowThemedStaticStyles, bookingFlowThemedThemeStyles } from "./bookingFlowThemeStyles";
import { useIsFavorite, useToggleFavorite } from "@/entities/favorite";
import { BookingFlowPlacePanel } from "@/shared/ui/booking-place-panel";
import {
  BookingProfileCompleteTip,
  showGuestFormValidationPopup,
  showMissingAvailableSlotPopup,
  showMissingBookingSlotPopup,
} from "@/features/booking-personal-data-notice";
import type { GuestFormFieldError } from "@/features/booking-personal-data-notice/lib/guestFormValidation";
import {
  DEFAULT_PHONE_VALUE,
  parseStoredPhone,
  serializePhone,
  validatePhoneValue,
  type PhoneValue,
} from "@/shared/ui/phone-input";
import { BookingFlowCustomerForm } from "./BookingFlowCustomerForm";
import { isPersonalDataComplete } from "@/shared/lib/profileCompletion";
import { useAndroidFullSwipeBackPanHandlers } from "@/shared/lib/useAndroidFullSwipeBackPanHandlers";
import { useDisableGestureDuringTransition } from "@/shared/lib/navigation/useDisableGestureDuringTransition";
import { devWarn } from "@/shared/lib/devLog";
import { isInsufficientBookingCreditsError } from "@/entities/booking-credits";
import { useBookingAccess } from "@/features/booking-access";
import { BookingCreditsBadge } from "@/shared/ui/booking-credits-badge/BookingCreditsBadge";
import {
  shouldEnforceSubscriptionPaywall,
  useSubscriptionPaywallRedirect,
} from "@/features/subscription-paywall-redirect";
import {
  BOOKING_FLOW_DEFAULT_GUESTS,
  BOOKING_FLOW_MAX_GUESTS,
  BOOKING_FLOW_MIN_GUESTS,
  BOOKING_FLOW_TOTAL_STEPS,
} from "../model/constants";
import { BookingTimePicker } from "@/shared/ui/booking-time-picker";
import { useScrollToFocusedInput } from "@/shared/lib/keyboard";

import {
  CALENDAR_MONTHS_AHEAD,
  WEEKDAY_LABELS,
  startOfLocalDay,
  toYmd,
  fromYmd,
  monthKey,
  firstOfMonthContaining,
  buildMonthCells,
  chunkCells,
} from "@/shared/lib/bookingCalendar";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FOOTER_VERTICAL_PAD = 8;
const FOOTER_BUTTON_HEIGHT = 44;
const CONTINUE_THROTTLE_MS = 600;

type R = RouteProp<BrowseFlowParamList, "BookingFlow">;
type Nav = NativeStackNavigationProp<BrowseFlowParamList, "BookingFlow">;

export default function BookingFlowPage() {
  const { id } = useRoute<R>().params;
  const navigation = useNavigation<Nav>();
  useDisableGestureDuringTransition();
  const androidSwipeBackPanHandlers = useAndroidFullSwipeBackPanHandlers(navigation, {
    sensitivity: "high",
  });
  const { colors, isDark } = useAppTheme();
  const { session, user } = useAuth();
  const { data: profile } = useProfile();
  const { data: place, isLoading: placeLoading } = useBusinessCard(id);
  const isFavorite = useIsFavorite(id);
  const toggleFavorite = useToggleFavorite();
  const createCartItem = useCreateCartItem();
  const createBooking = useCreateBooking();
  const startN8nWaBooking = useStartN8nWaBooking();
  const { t } = useTranslation();
  const {
    canAccessBookingFlow,
    isLoading: accessLoading,
    canUseBookingCredits,
    balance,
    isIntroActive,
    hasPaidPremium,
    introPeriodEndsAt,
  } = useBookingAccess();
  const shouldEnforcePaywall = shouldEnforceSubscriptionPaywall();
  useSubscriptionPaywallRedirect({
    accessLoading,
    shouldEnforcePaywall,
    hasAccess: canAccessBookingFlow,
    paywallReason: !canUseBookingCredits ? "no_credits" : "upgrade",
    navigation: navigation as {
      replace: (name: "SubscriptionPaywall", params?: { reason?: "no_credits" | "upgrade" }) => void;
    },
  });

  const [step, setStep] = useState(0);
  const [selectedDateYmd, setSelectedDateYmd] = useState(() => toYmd(new Date()));
  const [visibleCalendarMonth, setVisibleCalendarMonth] = useState<Date>(() => firstOfMonthContaining(new Date()));
  const [selectedBookingTime, setSelectedBookingTime] = useState<Date | null>(null);
  const [guests, setGuests] = useState(BOOKING_FLOW_DEFAULT_GUESTS);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState<PhoneValue>(DEFAULT_PHONE_VALUE);
  const [customerEmail, setCustomerEmail] = useState("");
  const [comment, setComment] = useState("");
  const [confirming, setConfirming] = useState(false);
  const confirmingRef = useRef(false);
  const continueLockRef = useRef(false);
  const lastContinueAtRef = useRef(0);
  const continueUnlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [celebrationActive, setCelebrationActive] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const { onInputFocus, onScroll } = useScrollToFocusedInput(scrollRef);
  const totalSteps = BOOKING_FLOW_TOTAL_STEPS + 1;
  const useMonotoneDarkBackground = isDark && (step === 0 || step === 2);
  const selectedDate = useMemo(() => fromYmd(selectedDateYmd), [selectedDateYmd]);
  const themed = useThemeStyles(({ colors: c, isDark: dark }) => bookingFlowThemedThemeStyles(c, dark));
  const themedStyles = useMemo(
    () => mergeStaticAndThemed(bookingFlowThemedStaticStyles, themed),
    [themed],
  );
  const calendarCells = useMemo(
    () => buildMonthCells(visibleCalendarMonth.getFullYear(), visibleCalendarMonth.getMonth()),
    [visibleCalendarMonth],
  );
  const {
    data: slotsForDate = [],
    isFetching: slotsFetching,
    isError: slotsError,
    refetch: refetchSlots,
  } = useAvailableSlots(id, selectedDateYmd);
  const selectedAvailableSlot = useMemo(() => {
    if (!selectedBookingTime) return null;
    return findBookingSlotForTime(slotsForDate, minutesFromDate(selectedBookingTime));
  }, [selectedBookingTime, slotsForDate]);
  const selectedTimeLabel = selectedBookingTime
    ? formatBookingTimeLabel(minutesFromDate(selectedBookingTime))
    : "";
  const timeUnavailableReason = useMemo(() => {
    if (!selectedBookingTime) return null;
    return resolveBookingTimeUnavailableReason({
      slot: selectedAvailableSlot,
      dateYmd: selectedDateYmd,
      totalMinutes: minutesFromDate(selectedBookingTime),
    });
  }, [selectedAvailableSlot, selectedBookingTime, selectedDateYmd]);
  const timeSelectionUnavailable = timeUnavailableReason != null;
  const showProfileCompleteTip = !isPersonalDataComplete(profile);

  useEffect(() => {
    setSelectedBookingTime(defaultBookingDateTime(selectedDateYmd));
  }, [selectedDateYmd]);

  useEffect(() => {
    if (!profile) return;
    const defaultFullName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
    const defaultPhone = parseStoredPhone(profile.phone);
    const defaultEmail = (profile.email ?? user?.email ?? "").trim();
    setCustomerName((prev) => (prev.trim() ? prev : defaultFullName));
    setCustomerPhone((prev) => (prev.nationalDigits ? prev : defaultPhone));
    setCustomerEmail((prev) => (prev.trim() ? prev : defaultEmail));
  }, [profile, user?.email]);

  const getGuestFormError = useCallback((): GuestFormFieldError | null => {
    if (!Number.isFinite(guests) || guests < BOOKING_FLOW_MIN_GUESTS) return "partySize";
    if (!customerName.trim()) return "name";
    if (validatePhoneValue(customerPhone) !== null) return "phone";
    if (!EMAIL_REGEX.test(customerEmail.trim())) return "email";
    return null;
  }, [customerEmail, customerName, customerPhone, guests]);

  const scheduleContinueUnlock = useCallback(() => {
    if (continueUnlockTimerRef.current) {
      clearTimeout(continueUnlockTimerRef.current);
    }
    continueUnlockTimerRef.current = setTimeout(() => {
      continueLockRef.current = false;
      continueUnlockTimerRef.current = null;
    }, CONTINUE_THROTTLE_MS);
  }, []);

  const resetContinueThrottle = useCallback(() => {
    if (continueUnlockTimerRef.current) {
      clearTimeout(continueUnlockTimerRef.current);
      continueUnlockTimerRef.current = null;
    }
    continueLockRef.current = false;
    lastContinueAtRef.current = 0;
  }, []);

  useEffect(() => {
    if (step > BOOKING_FLOW_TOTAL_STEPS) {
      setStep(BOOKING_FLOW_TOTAL_STEPS);
    }
  }, [step]);

  useEffect(() => () => {
    if (continueUnlockTimerRef.current) {
      clearTimeout(continueUnlockTimerRef.current);
    }
  }, []);

  const handleContinue = useCallback(() => {
    const now = Date.now();
    if (continueLockRef.current || now - lastContinueAtRef.current < CONTINUE_THROTTLE_MS) {
      return;
    }

    if (step === 1 && !selectedBookingTime) {
      showMissingBookingSlotPopup(t);
      return;
    }
    if (step === 1 && timeSelectionUnavailable) {
      showMissingAvailableSlotPopup(t);
      return;
    }
    if (step === 1) {
      const formError = getGuestFormError();
      if (formError) {
        showGuestFormValidationPopup({ error: formError, t });
        return;
      }
    }

    if (step >= BOOKING_FLOW_TOTAL_STEPS) return;

    continueLockRef.current = true;
    lastContinueAtRef.current = now;
    setStep((prev) => Math.min(prev + 1, BOOKING_FLOW_TOTAL_STEPS));
    scheduleContinueUnlock();
  }, [getGuestFormError, scheduleContinueUnlock, selectedBookingTime, step, t, timeSelectionUnavailable]);

  const handleStepBack = useCallback(() => {
    resetContinueThrottle();
    setStep((prev) => Math.max(prev - 1, 0));
  }, [resetContinueThrottle]);

  const handleFooterBack = useCallback(() => {
    resetContinueThrottle();
    if (step === 0) {
      navigation.goBack();
      return;
    }
    setStep(step - 1);
  }, [navigation, resetContinueThrottle, step]);

  if (placeLoading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!place) return null;

  if (accessLoading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (shouldEnforcePaywall && !canAccessBookingFlow) {
    return null;
  }

  const todayYmd = toYmd(startOfLocalDay(new Date()));
  const earliestBookableMonth = firstOfMonthContaining(new Date());
  const latestBookableMonth = new Date(
    earliestBookableMonth.getFullYear(),
    earliestBookableMonth.getMonth() + CALENDAR_MONTHS_AHEAD,
    1,
  );
  const canGoPrevMonth = monthKey(visibleCalendarMonth) > monthKey(earliestBookableMonth);
  const canGoNextMonth = monthKey(visibleCalendarMonth) < monthKey(latestBookableMonth);

  const onFavoritePress = () => {
    if (!user) {
      navigateToProfileAuth(navigation);
      return;
    }
    toggleFavorite.mutate({ businessCardId: place.id, isFavorite });
  };

  const handleConfirm = async () => {
    if (confirmingRef.current) return;
    if (!canUseBookingCredits) {
      showErrorToast(t("bookingCredits.noCreditsTitle"), t("bookingCredits.noCreditsMessage"));
      return;
    }
    if (!selectedBookingTime) {
      showMissingBookingSlotPopup(t);
      return;
    }
    if (!selectedAvailableSlot) {
      showMissingAvailableSlotPopup(t);
      return;
    }
    const formError = getGuestFormError();
    if (formError) {
      showGuestFormValidationPopup({ error: formError, t });
      return;
    }
    const dateTime = new Date(selectedAvailableSlot.dateTimeIso);
    const phoneToSave = serializePhone(customerPhone);
    confirmingRef.current = true;
    setConfirming(true);
    try {
      const price = Number(place.booking_price);
      await createBooking.mutateAsync({
        business_card_id: place.id,
        date_time: dateTime.toISOString(),
        cost: price,
        persons: guests,
        customer_name: customerName.trim(),
        customer_phone: phoneToSave,
        customer_email: customerEmail.trim(),
        comment: comment.trim() || null,
        payment_status: "pending",
        status: "upcoming",
      });
      const createdCartItem = await createCartItem.mutateAsync({
        business_card_id: place.id,
        date_time: dateTime.toISOString(),
        cost: price,
        persons: guests,
        customer_name: customerName.trim(),
        customer_phone: phoneToSave,
        customer_email: customerEmail.trim(),
        comment: comment.trim() || null,
        is_restaurant_table: false,
      });
      const accessToken = session?.access_token;
      if (accessToken && createdCartItem?.id) {
        void startN8nWaBooking.mutateAsync({ cartItemId: createdCartItem.id, accessToken }).catch((error) => {
          if (__DEV__) {
            devWarn("[n8n-wa-booking-start] invoke failed", error instanceof Error ? error.message : error);
          }
        });
      }
      trackBookingConfirmed(place.id, bookingChannelFromPhone(place.contact_whatsapp));
      setCelebrationActive(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showSuccessToast(t("bookingCommon.draftCreatedTitle"), t("bookingCommon.draftCreatedMessage"));
      setTimeout(() => {
        navigation.getParent()?.dispatch(
          CommonActions.navigate({
            name: "Bookings",
            params: { screen: "BookingsMain" },
          }),
        );
      }, 1200);
    } catch (error) {
      confirmingRef.current = false;
      setConfirming(false);
      if (isAuthRequiredError(error)) {
        navigateToAuthScreen(navigation);
        return;
      }
      if (isInsufficientBookingCreditsError(error)) {
        showErrorToast(t("bookingCredits.noCreditsTitle"), t("bookingCredits.noCreditsMessage"));
        return;
      }
      showErrorToast(t("bookingCommon.couldNotCreateDraft"));
    }
  };

  const adjustGuests = (delta: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setGuests((prev) =>
      Math.min(BOOKING_FLOW_MAX_GUESTS, Math.max(BOOKING_FLOW_MIN_GUESTS, prev + delta)),
    );
  };

  return (
    <>
    <View style={[styles.root, { backgroundColor: colors.background }]} {...androidSwipeBackPanHandlers}>
      {step === 1 ? (
        <SafeAreaView edges={["top"]} style={styles.stepOneTopChrome}>
          <BookingStepIndicator step={step} totalSteps={totalSteps} />
          <View style={styles.header}>
            <AppPressable onPress={handleStepBack}>
              <Text style={[styles.back, themedStyles.headerBack]}>←</Text>
            </AppPressable>
            <View>
              <Text style={[styles.title, themedStyles.headerTitle]}>Book {place.name}</Text>
              <Text style={[styles.stepText, themedStyles.headerStep]}>
                Step {step + 1} of {BOOKING_FLOW_TOTAL_STEPS + 1}
              </Text>
            </View>
          </View>
          {isIntroActive && !hasPaidPremium ? (
            <BookingCreditsBadge
              balance={balance}
              isIntroActive={isIntroActive}
              hasPaidPremium={hasPaidPremium}
              introPeriodEndsAt={introPeriodEndsAt}
              compact
              style={{ marginHorizontal: 12, marginBottom: 4 }}
            />
          ) : null}
        </SafeAreaView>
      ) : null}
      <BookingConfetti active={celebrationActive} />

      {step === 1 ? (
        <ScrollView
          ref={scrollRef}
          style={styles.stepScroll}
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={16}
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{
            paddingBottom: FOOTER_VERTICAL_PAD * 2 + FOOTER_BUTTON_HEIGHT + 16,
          }}
        >
          <View style={styles.stepContent}>
            <Text style={[styles.section, themedStyles.sectionText]}>Select date & time</Text>
            <View style={[styles.calendarPanel, themedStyles.calendarPanel]}>
              <View style={styles.calendarNav}>
                <AppPressable
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
                  style={[styles.calendarNavBtn, themedStyles.calendarNavBtn, !canGoPrevMonth && styles.calendarNavBtnDisabled]}
                >
                  <Ionicons name="chevron-back" size={22} color={canGoPrevMonth ? colors.text : colors.textMuted} />
                </AppPressable>
                <Text style={[styles.calendarMonthTitle, themedStyles.calendarMonthTitle]}>
                  {visibleCalendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                </Text>
                <AppPressable
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
                  style={[styles.calendarNavBtn, themedStyles.calendarNavBtn, !canGoNextMonth && styles.calendarNavBtnDisabled]}
                >
                  <Ionicons name="chevron-forward" size={22} color={canGoNextMonth ? colors.text : colors.textMuted} />
                </AppPressable>
              </View>
              <View style={styles.calendarDowRow}>
                {WEEKDAY_LABELS.map((label) => (
                  <Text key={label} style={[styles.calendarDowCell, themedStyles.calendarDowCell]}>
                    {label}
                  </Text>
                ))}
              </View>
              {chunkCells(calendarCells, 7).map((row, rowIdx) => (
                <View key={`w-${rowIdx}`} style={styles.calendarWeekRow}>
                  {row.map((cell, colIdx) => {
                    if (cell.kind === "pad") {
                      return <View key={`p-${rowIdx}-${colIdx}`} style={styles.calendarCell} />;
                    }
                    const { ymd, day } = cell;
                    const isSelected = selectedDateYmd === ymd;
                    const isToday = ymd === todayYmd;
                    const isPast = ymd < todayYmd;
                    return (
                      <View key={ymd} style={styles.calendarCell}>
                        <AppPressable
                          accessibilityRole="button"
                          accessibilityLabel={`${ymd}`}
                          disabled={isPast}
                          onPress={() => {
                            setSelectedDateYmd(ymd);
                          }}
                          style={[
                            styles.calendarCellDayInner,
                            themedStyles.calendarCellDayInner,
                            isToday && styles.calendarCellToday,
                            isToday && themedStyles.calendarCellToday,
                            isSelected && styles.calendarCellSelected,
                            isSelected && themedStyles.calendarCellSelected,
                            isPast && styles.calendarCellPast,
                            isPast && themedStyles.calendarCellPast,
                          ]}
                        >
                          <Text style={[styles.calendarCellDayText, themedStyles.calendarCellDayText, isPast && themedStyles.calendarCellPastText]}>
                            {day}
                          </Text>
                        </AppPressable>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
            {slotsFetching ? (
              <ActivityIndicator style={styles.slotsLoading} color={colors.primary} />
            ) : slotsError ? (
              <View style={styles.slotsError}>
                <Text style={themedStyles.headerStep}>Could not load available slots.</Text>
                <AppPressable style={styles.retrySlotsBtn} onPress={() => void refetchSlots()}>
                  <Text style={themedStyles.headerTitle}>Retry</Text>
                </AppPressable>
              </View>
            ) : slotsForDate.length === 0 ? (
              <Text style={[styles.slotsEmptyText, themedStyles.headerStep]}>No time slots for this date.</Text>
            ) : (
              <BookingTimePicker
                dateYmd={selectedDateYmd}
                value={selectedBookingTime}
                onChange={setSelectedBookingTime}
                unavailableReason={timeUnavailableReason}
                style={styles.timePicker}
              />
            )}
            <BookingFlowCustomerForm
              customerName={customerName}
              onCustomerNameChange={setCustomerName}
              customerPhone={customerPhone}
              onCustomerPhoneChange={setCustomerPhone}
              customerEmail={customerEmail}
              onCustomerEmailChange={setCustomerEmail}
              comment={comment}
              onCommentChange={setComment}
              onInputFocus={onInputFocus}
            />
            <BookingProfileCompleteTip
              visible={showProfileCompleteTip}
              navigation={navigation}
              style={{ marginTop: 16 }}
            />
          </View>
        </ScrollView>
      ) : (
        <View style={styles.panelFill}>
          {step === 0 ? (
            <BookingFlowPlacePanel
              place={{
                id: place.id,
                name: place.name,
                address: place.address,
                rating: place.rating,
                images: place.images,
              }}
              isFavorite={isFavorite}
              onPressFavorite={onFavoritePress}
              onPressBack={() => navigation.goBack()}
              useMonotoneDarkBackground={useMonotoneDarkBackground}
            >
              <BookingStepIndicator step={step} totalSteps={totalSteps} />
              <Text style={[styles.section, themedStyles.sectionText, { marginTop: 16 }]}>Number of guests</Text>
              <View style={styles.guestRow}>
                <AppPressable style={[styles.guestBtn, themedStyles.guestButton]} onPress={() => adjustGuests(-1)}>
                  <Text style={[styles.guestBtnText, themedStyles.guestButtonText]}>−</Text>
                </AppPressable>
                <Text style={[styles.guestCount, themedStyles.guestCountText]}>{guests}</Text>
                <AppPressable style={[styles.guestBtn, themedStyles.guestButton]} onPress={() => adjustGuests(1)}>
                  <Text style={[styles.guestBtnText, themedStyles.guestButtonText]}>+</Text>
                </AppPressable>
              </View>
            </BookingFlowPlacePanel>
          ) : null}

          {step === 2 ? (
            <BookingFlowPlacePanel
              place={{
                id: place.id,
                name: place.name,
                address: place.address,
                rating: place.rating,
                images: place.images,
              }}
              isFavorite={isFavorite}
              onPressFavorite={onFavoritePress}
              onPressBack={handleStepBack}
              useMonotoneDarkBackground={useMonotoneDarkBackground}
            >
              <BookingStepIndicator step={step} totalSteps={totalSteps} />
              <Text style={[styles.section, themedStyles.sectionText, { marginTop: 16 }]}>Confirm</Text>
              <Text style={[themedStyles.confirmText, { fontSize: 18, fontWeight: "700" }]}>{place.name}</Text>
              <Text style={themedStyles.confirmText}>
                {guests} guests · {selectedDate.toDateString()} {selectedTimeLabel}
              </Text>
              <BookingWhatsAppBanner channel={bookingChannelFromPhone(place.contact_whatsapp)} />
            </BookingFlowPlacePanel>
          ) : null}
        </View>
      )}

      <View style={[styles.footer, themedStyles.footer]}>
        <View style={styles.footerRow}>
          <AppPressable
            style={[styles.secondary, themedStyles.footerSecondaryBtn]}
            onPress={handleFooterBack}
          >
            <Text
              style={[styles.secondaryText, themedStyles.footerSecondaryBtnText]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {t("bookingCommon.backStep")}
            </Text>
          </AppPressable>
          {step < BOOKING_FLOW_TOTAL_STEPS ? (
            <AppPressable
              style={[styles.primary, styles.footerPrimaryBtn]}
              onPress={handleContinue}
            >
              <Text style={styles.primaryText}>Continue</Text>
            </AppPressable>
          ) : (
            <AppPressable
              style={[styles.primary, styles.footerPrimaryBtn]}
              disabled={confirming}
              accessibilityState={{ disabled: confirming }}
              onPress={() => void handleConfirm()}
            >
              <Text style={styles.primaryText}>Confirm booking</Text>
            </AppPressable>
          )}
        </View>
      </View>
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  panelFill: { flex: 1, justifyContent: "space-between" },
  stepScroll: { flex: 1 },
  stepOneTopChrome: {
    gap: 8,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 8 },
  stepContent: { paddingHorizontal: 16, paddingTop: 16 },
  back: { fontSize: 22 },
  title: { fontSize: 18, fontWeight: "700" },
  stepText: { fontSize: 12, color: "#888" },
  section: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  guestRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24, paddingVertical: 24 },
  guestBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
  },
  guestBtnText: { fontSize: 22 },
  guestCount: { fontSize: 40, fontWeight: "800", width: 48, textAlign: "center" },
  calendarPanel: {
    borderRadius: 10,
    padding: 8,
    marginTop: 4,
    backgroundColor: "#fff",
  },
  calendarNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  calendarNavBtn: { padding: 8, borderRadius: 8 },
  calendarNavBtnDisabled: { opacity: 0.35 },
  calendarMonthTitle: { fontWeight: "800", fontSize: 16 },
  calendarDowRow: { flexDirection: "row", marginBottom: 4 },
  calendarDowCell: {
    flex: 1,
    textAlign: "center",
    color: "#9ca3af",
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
    backgroundColor: "#fff",
  },
  calendarCellDayText: { color: "#111", fontSize: 15, fontWeight: "700" },
  calendarCellToday: { borderStyle: "dashed", borderColor: "#d1d5db" },
  calendarCellSelected: { borderColor: "#111", backgroundColor: "#f3f4f6" },
  calendarCellPast: { opacity: 0.38 },
  timePicker: { marginTop: 16 },
  slotsLoading: { marginTop: 16 },
  slotsError: { marginTop: 16, gap: 8 },
  retrySlotsBtn: { alignSelf: "flex-start", paddingVertical: 8 },
  slotsEmptyText: { marginTop: 16 },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: FOOTER_VERTICAL_PAD,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  footerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  footerPrimaryBtn: { flex: 1, minWidth: 0 },
  secondary: {
    flex: 1,
    minWidth: 0,
    minHeight: FOOTER_BUTTON_HEIGHT,
    height: FOOTER_BUTTON_HEIGHT,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
  },
  secondaryText: {
    fontWeight: "700",
    fontSize: 15,
    lineHeight: 20,
    color: "#111",
  },
  primary: {
    ...primaryPressableStyle,
    minHeight: FOOTER_BUTTON_HEIGHT,
    height: FOOTER_BUTTON_HEIGHT,
    paddingVertical: 0,
  },
  primaryText: {
    ...primaryPressableTextStyle,
    fontSize: 15,
    lineHeight: 20,
  },
});
